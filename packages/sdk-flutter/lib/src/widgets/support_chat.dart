import 'dart:async';
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
    final soft = dark ? const Color(0xFF1B201D) : const Color(0xFFF3F6F3);
    final foreground = dark ? const Color(0xFFE5EAE6) : const Color(0xFF354239);
    final customer =
        (_chat?['customer'] as Map?)?.cast<String, dynamic>() ??
        <String, dynamic>{};
    Widget card(Map<String, dynamic> data) => _SupportCard(
      key: ValueKey(data['id']),
      data: data,
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
    return ColoredBox(
      color: canvas,
      child: DefaultTextStyle(
        style: TextStyle(fontSize: 16, height: 1.5, color: foreground),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      widget.configuration['businessName'] as String? ??
                          'Support',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  Text(
                    _chat?['state'] == 'WAITING'
                        ? 'Your request is with the team'
                        : _chat?['state'] == 'HUMAN'
                        ? 'The team is here to help'
                        : 'Ask a question. We’re here to help.',
                    style: const TextStyle(fontSize: 14),
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
                        final active =
                            _chat?['activeWidgetMessageId'] == message['id'];
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
                                  fontSize: 14,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: mine ? soft : canvas,
                                  border: Border.all(
                                    color: dark
                                        ? const Color(0xFF303B33)
                                        : const Color(0xFFDFE6E0),
                                  ),
                                  borderRadius: BorderRadius.circular(18),
                                ),
                                child: SelectableText(
                                  message['content'] as String? ?? '',
                                  style: TextStyle(
                                    fontSize: 16,
                                    height: 1.55,
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
                                    style: const TextStyle(fontSize: 14),
                                  ),
                                ),
                              if (active)
                                for (final entry
                                    in (metadata['widgets'] as List? ?? []))
                                  if (entry['type'] != 'contact_form' ||
                                      _chat?['canEscalate'] == true)
                                    card(
                                      (entry as Map).cast<String, dynamic>(),
                                    ),
                            ],
                          ),
                        );
                      },
                    ),
                  if (_chat?['canEscalate'] == true &&
                      _chat?['activeWidgetMessageId'] == null)
                    card({
                      'id': 'contact:${_chat!['id']}',
                      'type': 'contact_form',
                      'title': 'Let the team follow up',
                      'summary': _chat?['escalationSummary'] ?? '',
                    }),
                  if (_chat?['ticketReference'] != null)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: SelectableText(
                        'Reference: ${_chat!['ticketReference']}${_chat?['supportEmail'] != null ? '\nContact: ${_chat!['supportEmail']}' : ''}',
                        style: const TextStyle(fontSize: 14),
                      ),
                    ),
                  if (_chat?['aiPending'] == true)
                    const Padding(
                      padding: EdgeInsets.all(8),
                      child: Text('Thinking…', style: TextStyle(fontSize: 14)),
                    ),
                ],
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Text(
                  _error!,
                  style: TextStyle(
                    fontSize: 14,
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
                        style: const TextStyle(fontSize: 16),
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
                        backgroundColor: const Color(0xFF5B7168),
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
    required this.customer,
    required this.busy,
    required this.onReply,
    required this.onSubmit,
  });
  final Map<String, dynamic> data, customer;
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
  bool _open = false, _done = false;
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
    padding: const EdgeInsets.only(top: 12),
    child: TextFormField(
      controller: controller,
      readOnly: readOnly,
      maxLength: maxLength,
      maxLines: lines,
      keyboardType: email ? TextInputType.emailAddress : TextInputType.text,
      autofillHints: email ? const [AutofillHints.email] : null,
      style: const TextStyle(fontSize: 16),
      decoration: InputDecoration(
        labelText: label,
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
        padding: EdgeInsets.all(12),
        child: Text('Details sent.', style: TextStyle(fontSize: 14)),
      );
    }
    final quick =
        data['type'] == 'quick_replies' || data['type'] == 'confirmation';
    if (quick) {
      return Padding(
        padding: const EdgeInsets.only(top: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(data['title'] as String, style: const TextStyle(fontSize: 14)),
            Wrap(
              spacing: 8,
              runSpacing: 8,
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
                        style: const TextStyle(fontSize: 14),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ],
        ),
      );
    }
    final contact = data['type'] == 'contact_form';
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.dark
            ? const Color(0xFF181D1A)
            : const Color(0xFFF5F7F5),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Form(
        key: _form,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              data['title'] as String,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
            if (contact) ...[
              const SizedBox(height: 8),
              Text(
                data['summary'] as String? ?? '',
                style: const TextStyle(fontSize: 14),
              ),
            ],
            if (contact && !_open)
              OutlinedButton(
                onPressed: widget.busy
                    ? null
                    : () => setState(() => _open = true),
                child: const Text('Ask the team'),
              ),
            if (!contact || _open) ...[
              if (contact) ...[
                const SizedBox(height: 8),
                const Text(
                  'Share your details so support can reach you.',
                  style: TextStyle(fontSize: 14),
                ),
                _field('Your name', _name, required: true, maxLength: 100),
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
              ] else ...[
                _field('What is happening?', _summary, required: true),
                _field(
                  'What have you tried? (optional)',
                  _details,
                  maxLength: 2000,
                  lines: 2,
                ),
                _field(
                  'Order or issue reference (optional)',
                  _reference,
                  maxLength: 100,
                ),
              ],
              const SizedBox(height: 12),
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF5B7168),
                  foregroundColor: Colors.white,
                  minimumSize: const Size(44, 48),
                ),
                onPressed: widget.busy ? null : _submit,
                child: Text(contact ? 'Send to the team' : 'Send details'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
