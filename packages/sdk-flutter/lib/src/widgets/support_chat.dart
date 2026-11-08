import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import '../support_client.dart';

/// Support inside the existing feedback sheet, rendered with native Flutter UI.
class SupportChat extends StatefulWidget {
  const SupportChat({
    super.key,
    required this.client,
    required this.configuration,
  });
  final SupportClient client;
  final Map<String, dynamic> configuration;
  @override
  State<SupportChat> createState() => _SupportChatState();
}

class _SupportChatState extends State<SupportChat> with WidgetsBindingObserver {
  final _text = TextEditingController();
  final _scroll = ScrollController();
  Map<String, dynamic>? _chat;
  Timer? _timer;
  bool _busy = false;
  bool _polling = false;
  bool _foreground = true;
  String? _error;
  String? _pendingText;
  String? _pendingId;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(_restore());
    _timer = Timer.periodic(const Duration(milliseconds: 2500), (_) async {
      if (!_foreground || _polling || _chat == null) return;
      _polling = true;
      try {
        await _refresh(_chat!['id'] as String);
      } catch (e) {
        if (mounted) setState(() => _error = e.toString());
      } finally {
        _polling = false;
      }
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
  }

  Future<void> _restore() async {
    try {
      final items = await widget.client.conversations();
      if (items.isNotEmpty && mounted) {
        await _refresh(items.first['id'] as String);
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  Future<void> _refresh(String id) async {
    final chat = await widget.client.conversation(id);
    if (!mounted) return;
    final changed =
        (_chat?['messages'] as List?)?.length !=
        (chat['messages'] as List).length;
    setState(() => _chat = chat);
    if (changed) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _scroll.hasClients) {
          _scroll.animateTo(
            _scroll.position.maxScrollExtent,
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOut,
          );
        }
      });
    }
  }

  Future<bool> _perform(Future<void> Function() fn) async {
    if (_busy) return false;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await fn();
      return true;
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
      return false;
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<bool> _send([String? value]) => _perform(() async {
    final content = (value ?? _text.text).trim();
    if (content.isEmpty) return;
    final chat = _chat == null || _chat!['state'] == 'RESOLVED'
        ? await widget.client.startConversation()
        : _chat!;
    if (_pendingText != content) {
      _pendingText = content;
      _pendingId = supportMessageId();
    }
    await widget.client.send(
      chat['id'] as String,
      content,
      clientMessageId: _pendingId,
    );
    _pendingId = null;
    _pendingText = null;
    if (mounted) _text.clear();
    await _refresh(chat['id'] as String);
  });
  @override
  void dispose() {
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    _text.dispose();
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    final canvas = dark ? Colors.black : Colors.white;
    final soft = dark ? const Color(0xFF171717) : const Color(0xFFF5F5F5);
    final foreground = dark ? const Color(0xFFE5E5E5) : const Color(0xFF404040);
    final customer =
        (_chat?['customer'] as Map?)?.cast<String, dynamic>() ??
        <String, dynamic>{};
    final actions = <Map<String, dynamic>>[];
    for (final raw in (_chat?['messages'] as List? ?? [])) {
      final message = raw as Map;
      if (message['id'] != _chat?['activeWidgetMessageId']) continue;
      for (final entry
          in ((message['metadata'] as Map?)?['widgets'] as List? ?? [])) {
        if (entry['type'] != 'contact_form' || _chat?['canEscalate'] == true) {
          actions.add((entry as Map).cast<String, dynamic>());
        }
      }
    }
    if (_chat?['canEscalate'] == true &&
        _chat?['activeWidgetMessageId'] == null) {
      actions.add({
        'id': 'contact:${_chat!['id']}',
        'type': 'contact_form',
        'title': 'Let the team follow up',
        'summary': _chat?['escalationSummary'] ?? '',
      });
    }
    Widget card(Map<String, dynamic> data) => _SupportCard(
      key: ValueKey(data['id']),
      data: data,
      transferAvailable:
          (widget.configuration['online'] as List? ?? []).isNotEmpty,
      customer: customer,
      busy: _busy,
      onReply: _send,
      onSubmit: (values) => _perform(() async {
        final id = _chat!['id'] as String;
        if (data['type'] == 'contact_form') {
          await widget.client.handoff(
            id,
            values['name'] as String,
            values['email'] as String,
          );
        } else {
          await widget.client.details(id, values);
        }
        await _refresh(id);
      }),
    );
    final logoUrl = widget.configuration['logoUrl'] as String?;
    final fallback = Text(
      (widget.configuration['businessName'] as String? ?? 'S').substring(0, 1),
      style: const TextStyle(fontSize: 16),
    );
    Widget? icon;
    if (logoUrl != null && logoUrl.isNotEmpty) {
      try {
        icon = logoUrl.startsWith('data:image/png;base64,')
            ? Image.memory(
                base64Decode(logoUrl.substring(22)),
                fit: BoxFit.contain,
                errorBuilder: (_, _, _) => fallback,
              )
            : logoUrl.startsWith('https://')
            ? Image.network(
                logoUrl,
                fit: BoxFit.contain,
                errorBuilder: (_, _, _) => fallback,
              )
            : null;
      } catch (_) {
        icon = null;
      }
    }
    return ColoredBox(
      color: canvas,
      child: DefaultTextStyle(
        style: TextStyle(fontSize: 15, height: 1.5, color: foreground),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      if (icon != null) ...[
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: ColoredBox(
                            color: Colors.white,
                            child: SizedBox(width: 30, height: 30, child: icon),
                          ),
                        ),
                        const SizedBox(width: 10),
                      ],
                      Expanded(
                        child: Text(
                          widget.configuration['businessName'] as String? ??
                              'Support',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                  Text(
                    _chat?['state'] == 'WAITING'
                        ? 'Your request is with the team'
                        : _chat?['state'] == 'HUMAN'
                        ? 'The team is here to help'
                        : 'Ask a question. We’re here to help.',
                    style: const TextStyle(fontSize: 13),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                controller: _scroll,
                padding: const EdgeInsets.all(16),
                children: [
                  if (_chat == null) ...[
                    Text(
                      widget.configuration['welcomeMessage'] as String? ??
                          'How can we help?',
                    ),
                    const SizedBox(height: 16),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children:
                          [
                                'I need help getting started',
                                'Something isn’t working',
                              ]
                              .map(
                                (text) => OutlinedButton(
                                  onPressed: _busy ? null : () => _send(text),
                                  child: Text(text),
                                ),
                              )
                              .toList(),
                    ),
                  ],
                  for (final raw in (_chat?['messages'] as List? ?? []))
                    Builder(
                      builder: (context) {
                        final message = (raw as Map).cast<String, dynamic>();
                        final mine = message['role'] == 'CUSTOMER';
                        final metadata =
                            (message['metadata'] as Map?)
                                ?.cast<String, dynamic>() ??
                            <String, dynamic>{};
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 16),
                          child: Column(
                            crossAxisAlignment: mine
                                ? CrossAxisAlignment.end
                                : CrossAxisAlignment.start,
                            children: [
                              Text(
                                mine
                                    ? 'You'
                                    : message['authorName'] as String? ??
                                          'Support',
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: mine ? soft : canvas,
                                  border: Border.all(
                                    color: dark
                                        ? const Color(0xFF404040)
                                        : const Color(0xFFE5E5E5),
                                  ),
                                  borderRadius: BorderRadius.circular(18),
                                ),
                                child: SelectableText(
                                  message['content'] as String? ?? '',
                                  style: TextStyle(
                                    fontSize: 15,
                                    height: 1.5,
                                    color: foreground,
                                  ),
                                ),
                              ),
                              for (final source
                                  in (metadata['citations'] as List? ?? []))
                                Padding(
                                  padding: const EdgeInsets.only(top: 8),
                                  child: SelectableText(
                                    '${source['title']}\n${source['url']}',
                                    style: const TextStyle(fontSize: 13),
                                  ),
                                ),
                            ],
                          ),
                        );
                      },
                    ),
                  if (_chat?['ticketReference'] != null)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: SelectableText(
                        'Reference: ${_chat!['ticketReference']}${_chat?['supportEmail'] != null ? '\nContact: ${_chat!['supportEmail']}' : ''}',
                        style: const TextStyle(fontSize: 13),
                      ),
                    ),
                  if (_chat?['aiPending'] == true)
                    const Padding(
                      padding: EdgeInsets.all(8),
                      child: Text('Thinking…', style: TextStyle(fontSize: 13)),
                    ),
                ],
              ),
            ),
            if (actions.isNotEmpty)
              ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight:
                      (MediaQuery.sizeOf(context).height -
                          MediaQuery.viewInsetsOf(context).bottom) *
                      .38,
                ),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 4,
                  ),
                  child: _SupportActions(
                    key: ValueKey(
                      _chat?['activeWidgetMessageId'] ?? _chat?['id'],
                    ),
                    actions: actions,
                    card: card,
                  ),
                ),
              ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Text(
                  _error!,
                  style: TextStyle(
                    fontSize: 13,
                    color: theme.colorScheme.error,
                  ),
                ),
              ),
            SafeArea(
              top: false,
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                  12,
                  8,
                  12,
                  MediaQuery.viewInsetsOf(context).bottom + 8,
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _text,
                        minLines: 1,
                        maxLines: 4,
                        maxLength: 4000,
                        style: const TextStyle(fontSize: 15),
                        textCapitalization: TextCapitalization.sentences,
                        decoration: InputDecoration(
                          hintText: 'How can we help?',
                          counterText: '',
                          filled: true,
                          fillColor: soft,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(18),
                            borderSide: BorderSide.none,
                          ),
                        ),
                        onSubmitted: (_) => _send(),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton.filled(
                      tooltip: 'Send message',
                      style: IconButton.styleFrom(
                        backgroundColor: Theme.of(context).colorScheme.primary,
                        foregroundColor: Colors.white,
                        minimumSize: const Size(48, 48),
                      ),
                      onPressed: _busy ? null : () => _send(),
                      icon: _busy
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.arrow_upward),
                    ),
                  ],
                ),
              ),
            ),
            if (widget.configuration['showBranding'] != false)
              const Padding(
                padding: EdgeInsets.only(bottom: 8),
                child: Text(
                  'Powered by UpStep',
                  style: TextStyle(fontSize: 12),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _SupportCard extends StatefulWidget {
  const _SupportCard({
    super.key,
    required this.data,
    required this.transferAvailable,
    required this.customer,
    required this.busy,
    required this.onReply,
    required this.onSubmit,
  });
  final Map<String, dynamic> data, customer;
  final bool transferAvailable;
  final bool busy;
  final Future<bool> Function(String) onReply;
  final Future<bool> Function(Map<String, dynamic>) onSubmit;
  @override
  State<_SupportCard> createState() => _SupportCardState();
}

class _SupportCardState extends State<_SupportCard> {
  final _form = GlobalKey<FormState>();
  late final _name = TextEditingController(
    text: widget.customer['name'] as String?,
  );
  late final _email = TextEditingController(
    text: widget.customer['email'] as String?,
  );
  final _summary = TextEditingController(),
      _details = TextEditingController(),
      _reference = TextEditingController();
  final _messageId = supportMessageId();
  int _step = 0;
  bool _issueOpen = false, _more = false, _done = false;
  @override
  void dispose() {
    for (final c in [_name, _email, _summary, _details, _reference]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    final contact = widget.data['type'] == 'contact_form';
    final ok = await widget.onSubmit(
      contact
          ? {'name': _name.text.trim(), 'email': _email.text.trim()}
          : {
              'widgetId': widget.data['id'],
              'summary': _summary.text.trim(),
              'details': _details.text.trim(),
              'reference': _reference.text.trim(),
              'clientMessageId': _messageId,
            },
    );
    if (mounted && ok) setState(() => _done = true);
  }

  Widget _field(
    String label,
    TextEditingController controller, {
    bool required = false,
    bool email = false,
    bool readOnly = false,
    int maxLength = 160,
    int lines = 1,
  }) => Padding(
    padding: const EdgeInsets.only(top: 8),
    child: TextFormField(
      key: ValueKey(label),
      controller: controller,
      readOnly: readOnly,
      maxLength: maxLength,
      maxLines: lines,
      keyboardType: email ? TextInputType.emailAddress : TextInputType.text,
      autofillHints: email ? const [AutofillHints.email] : null,
      style: const TextStyle(fontSize: 15),
      decoration: InputDecoration(
        labelText: label,
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 12,
          vertical: 12,
        ),
        counterText: '',
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      ),
      validator: (value) {
        if (required && (value == null || value.trim().isEmpty)) {
          return 'Please enter $label';
        }
        if (email &&
            !RegExp(
              r'^[^\s@]+@[^\s@]+\.[^\s@]+$',
            ).hasMatch(value?.trim() ?? '')) {
          return 'Enter a valid email address';
        }
        return null;
      },
    ),
  );
  @override
  Widget build(BuildContext context) {
    final data = widget.data;
    if (_done) {
      return const Padding(
        padding: EdgeInsets.all(8),
        child: Text('Details sent.', style: TextStyle(fontSize: 13)),
      );
    }
    final quick =
        data['type'] == 'quick_replies' || data['type'] == 'confirmation';
    if (quick) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(data['title'] as String, style: const TextStyle(fontSize: 13)),
          Wrap(
            spacing: 8,
            runSpacing: 4,
            children: (data['options'] as List)
                .map(
                  (option) => OutlinedButton(
                    onPressed: widget.busy
                        ? null
                        : () async {
                            final ok = await widget.onReply(option as String);
                            if (mounted && ok) setState(() => _done = true);
                          },
                    child: Text(
                      option as String,
                      style: const TextStyle(fontSize: 13),
                    ),
                  ),
                )
                .toList(),
          ),
        ],
      );
    }
    final contact = data['type'] == 'contact_form';
    Widget primary(String title, VoidCallback onPressed) => FilledButton(
      style: FilledButton.styleFrom(
        backgroundColor: Theme.of(context).colorScheme.primary,
        foregroundColor: Colors.white,
        minimumSize: const Size(44, 40),
      ),
      onPressed: widget.busy ? null : onPressed,
      child: Text(title, style: const TextStyle(fontSize: 13)),
    );
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.dark
            ? const Color(0xFF171717)
            : const Color(0xFFFAFAFA),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Form(
        key: _form,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    data['title'] as String,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                if (contact && _step > 0)
                  Text('$_step of 2', style: const TextStyle(fontSize: 12)),
              ],
            ),
            if (contact && _step == 0) ...[
              const SizedBox(height: 4),
              Text(
                data['summary'] as String? ?? '',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 13),
              ),
              Align(
                alignment: Alignment.centerLeft,
                child: OutlinedButton(
                  onPressed: widget.busy
                      ? null
                      : () => setState(() => _step = 1),
                  child: const Text(
                    'Ask the team',
                    style: TextStyle(fontSize: 13),
                  ),
                ),
              ),
            ],
            if (contact && _step > 0) ...[
              if (_step == 1)
                _field('Your name', _name, required: true, maxLength: 100)
              else
                _field(
                  'Email address',
                  _email,
                  required: true,
                  email: true,
                  readOnly:
                      widget.customer['verified'] == true &&
                      widget.customer['email'] != null,
                  maxLength: 254,
                ),
              const SizedBox(height: 8),
              Row(
                children: [
                  TextButton(
                    onPressed: widget.busy
                        ? null
                        : () => setState(() => _step--),
                    child: const Text('Back', style: TextStyle(fontSize: 13)),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: primary(
                      _step == 1
                          ? 'Continue'
                          : widget.transferAvailable
                          ? 'Request transfer'
                          : 'Send to the team',
                      () {
                        if (_step == 1) {
                          if (_form.currentState!.validate()) {
                            setState(() => _step = 2);
                          }
                        } else {
                          _submit();
                        }
                      },
                    ),
                  ),
                ],
              ),
            ],
            if (!contact && !_issueOpen)
              Align(
                alignment: Alignment.centerLeft,
                child: OutlinedButton(
                  onPressed: widget.busy
                      ? null
                      : () => setState(() => _issueOpen = true),
                  child: const Text(
                    'Add issue details',
                    style: TextStyle(fontSize: 13),
                  ),
                ),
              ),
            if (!contact && _issueOpen) ...[
              _field('What is happening?', _summary, required: true),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: () => setState(() => _more = !_more),
                  child: Text(
                    _more
                        ? 'Hide optional details'
                        : 'Add notes or a reference (optional)',
                    style: const TextStyle(fontSize: 13),
                  ),
                ),
              ),
              if (_more) ...[
                _field(
                  'What have you tried?',
                  _details,
                  maxLength: 2000,
                  lines: 2,
                ),
                _field('Order or issue reference', _reference, maxLength: 100),
              ],
              primary('Send details', _submit),
            ],
          ],
        ),
      ),
    );
  }
}

class _SupportActions extends StatefulWidget {
  const _SupportActions({super.key, required this.actions, required this.card});
  final List<Map<String, dynamic>> actions;
  final Widget Function(Map<String, dynamic>) card;
  @override
  State<_SupportActions> createState() => _SupportActionsState();
}

class _SupportActionsState extends State<_SupportActions> {
  late int _selected = widget.actions
      .indexWhere((a) => a['type'] == 'quick_replies')
      .clamp(0, widget.actions.length - 1);
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    mainAxisSize: MainAxisSize.min,
    children: [
      if (widget.actions.length > 1)
        Wrap(
          spacing: 8,
          children: [
            for (var i = 0; i < widget.actions.length; i++)
              ChoiceChip(
                label: Text(
                  widget.actions[i]['type'] == 'quick_replies'
                      ? 'Quick replies'
                      : 'Issue details',
                  style: const TextStyle(fontSize: 13),
                ),
                selected: _selected == i,
                onSelected: (_) => setState(() => _selected = i),
              ),
          ],
        ),
      widget.card(widget.actions[_selected]),
    ],
  );
}
