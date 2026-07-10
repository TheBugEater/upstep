import 'package:flutter/material.dart';

import '../controller.dart';
import '../models.dart';
import '../provider.dart';

class FeedbackSheet extends StatefulWidget {
  const FeedbackSheet({super.key});

  @override
  State<FeedbackSheet> createState() => _FeedbackSheetState();
}

class _FeedbackSheetState extends State<FeedbackSheet> {
  UpstepController? _controller;
  bool _isPresenting = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final next = Upstep.of(context);
    if (_controller != next) {
      _controller?.removeListener(_handleControllerChange);
      _controller = next;
      _controller?.addListener(_handleControllerChange);
    }
  }

  @override
  void dispose() {
    _controller?.removeListener(_handleControllerChange);
    super.dispose();
  }

  void _handleControllerChange() {
    final controller = _controller;
    if (!mounted || controller == null) return;
    if (controller.isOpen && !_isPresenting) {
      _presentSheet(controller);
    }
  }

  Future<void> _presentSheet(UpstepController controller) async {
    _isPresenting = true;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (BuildContext context) => _SheetScaffold(controller: controller),
    );
    _isPresenting = false;
    controller.closeSheet();
  }

  @override
  Widget build(BuildContext context) {
    return const SizedBox.shrink();
  }
}

class _SheetScaffold extends StatelessWidget {
  const _SheetScaffold({required this.controller});

  final UpstepController controller;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SizedBox(
      height: MediaQuery.of(context).size.height * 0.88,
      child: DefaultTabController(
        length: 2,
        child: Column(
          children: <Widget>[
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 8, 8),
              child: Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      'Upstep feedback',
                      style: theme.textTheme.titleLarge,
                    ),
                  ),
                  IconButton(
                    tooltip: 'Close',
                    onPressed: () => Navigator.of(context).maybePop(),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
            ),
            TabBar(
              indicatorColor: controller.accentColor,
              labelColor: controller.accentColor,
              tabs: const <Tab>[
                Tab(text: 'Top requests'),
                Tab(text: 'Send feedback'),
              ],
            ),
            Expanded(
              child: TabBarView(
                children: <Widget>[
                  _FeedTab(controller: controller),
                  _SubmitTab(controller: controller),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FeedTab extends StatelessWidget {
  const _FeedTab({required this.controller});

  final UpstepController controller;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (BuildContext context, Widget? child) {
        if (controller.feedLoading) {
          return const Center(child: CircularProgressIndicator());
        }

        if (controller.feedItems.isEmpty) {
          return RefreshIndicator(
            onRefresh: controller.loadFeed,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: const <Widget>[
                SizedBox(height: 120),
                Center(
                  child: Text('No feedback yet. Be the first to submit one.'),
                ),
              ],
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: controller.loadFeed,
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
            itemCount:
                controller.feedItems.length + (controller.showBranding ? 1 : 0),
            separatorBuilder: (_, _) => const SizedBox(height: 12),
            itemBuilder: (BuildContext context, int index) {
              if (controller.showBranding &&
                  index == controller.feedItems.length) {
                return Center(
                  child: Text(
                    'Powered by Upstep',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                );
              }

              final item = controller.feedItems[index];
              return _FeedbackCard(
                item: item,
                accentColor: controller.accentColor,
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => _FeedbackDetailPage(
                        controller: controller,
                        feedbackId: item.id,
                      ),
                    ),
                  );
                },
                onVote: () async {
                  try {
                    await controller.vote(item.id, VoteValue.up);
                  } catch (_) {
                    if (!context.mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Could not register that vote.'),
                      ),
                    );
                  }
                },
              );
            },
          ),
        );
      },
    );
  }
}

class _FeedbackCard extends StatelessWidget {
  const _FeedbackCard({
    required this.item,
    required this.accentColor,
    required this.onTap,
    required this.onVote,
  });

  final FeedbackItem item;
  final Color accentColor;
  final VoidCallback onTap;
  final VoidCallback onVote;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final voted = item.userVote == VoteValue.up;

    return Material(
      color: theme.colorScheme.surfaceContainerLowest,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              FilledButton.tonal(
                style: FilledButton.styleFrom(
                  backgroundColor: voted ? accentColor : null,
                  foregroundColor: voted ? Colors.white : null,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  minimumSize: const Size(0, 0),
                ),
                onPressed: onVote,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    const Icon(Icons.keyboard_arrow_up),
                    Text('${item.upvotes}'),
                  ],
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    if (item.title != null && item.title!.trim().isNotEmpty)
                      Text(item.title!, style: theme.textTheme.titleMedium),
                    Text(
                      item.content,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: <Widget>[
                        Chip(label: Text(item.type.label)),
                        Chip(label: Text(_statusLabel(item.status))),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FeedbackDetailPage extends StatelessWidget {
  const _FeedbackDetailPage({
    required this.controller,
    required this.feedbackId,
  });

  final UpstepController controller;
  final String feedbackId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Feedback')),
      body: FutureBuilder<FeedbackDetail>(
        future: controller.getItem(feedbackId),
        builder:
            (BuildContext context, AsyncSnapshot<FeedbackDetail> snapshot) {
              if (snapshot.connectionState != ConnectionState.done) {
                return const Center(child: CircularProgressIndicator());
              }
              if (snapshot.hasError || !snapshot.hasData) {
                return const Center(
                  child: Text('Could not load this feedback item.'),
                );
              }

              final item = snapshot.data!;
              return ListView(
                padding: const EdgeInsets.all(16),
                children: <Widget>[
                  Text(
                    item.title?.trim().isNotEmpty == true
                        ? item.title!
                        : item.type.label,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    item.content,
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: <Widget>[
                      Chip(label: Text(item.type.label)),
                      Chip(label: Text(_statusLabel(item.status))),
                      Chip(label: Text('${item.upvotes} upvotes')),
                    ],
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'Developer replies',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 12),
                  if (item.comments.isEmpty)
                    const Text('No replies yet.')
                  else
                    ...item.comments.map(
                      (CommentItem comment) => Card(
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Text(
                                comment.authorName?.trim().isNotEmpty == true
                                    ? comment.authorName!
                                    : 'Upstep team',
                                style: Theme.of(context).textTheme.titleSmall,
                              ),
                              const SizedBox(height: 6),
                              Text(comment.content),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
              );
            },
      ),
    );
  }
}

class _SubmitTab extends StatefulWidget {
  const _SubmitTab({required this.controller});

  final UpstepController controller;

  @override
  State<_SubmitTab> createState() => _SubmitTabState();
}

class _SubmitTabState extends State<_SubmitTab> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _contentController = TextEditingController();
  FeedbackType _type = FeedbackType.general;
  bool _submitting = false;

  @override
  void dispose() {
    _titleController.dispose();
    _contentController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);
    try {
      await widget.controller.submit(
        title: _titleController.text.trim().isEmpty
            ? null
            : _titleController.text.trim(),
        content: _contentController.text.trim(),
        type: _type,
      );
      _titleController.clear();
      _contentController.clear();
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Feedback submitted.')));
      DefaultTabController.of(context).animateTo(0);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not submit feedback.')),
      );
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: <Widget>[
          TextFormField(
            controller: _titleController,
            decoration: const InputDecoration(
              labelText: 'Title (optional)',
              border: OutlineInputBorder(),
            ),
            maxLength: 200,
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _contentController,
            decoration: const InputDecoration(
              labelText: 'What should we build or fix?',
              border: OutlineInputBorder(),
              alignLabelWithHint: true,
            ),
            maxLines: 6,
            minLines: 4,
            maxLength: 2000,
            validator: (String? value) {
              if (value == null || value.trim().isEmpty) {
                return 'Please enter some feedback.';
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          Text('Type', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: FeedbackType.values
                .map(
                  (FeedbackType type) => ChoiceChip(
                    label: Text(type.label),
                    selected: _type == type,
                    onSelected: (_) => setState(() => _type = type),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 24),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: widget.controller.accentColor,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            onPressed: _submitting ? null : _submit,
            child: _submitting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Send feedback'),
          ),
        ],
      ),
    );
  }
}

String _statusLabel(FeedbackStatus status) {
  switch (status) {
    case FeedbackStatus.pending:
      return 'In review';
    case FeedbackStatus.open:
      return 'Open';
    case FeedbackStatus.inProgress:
      return 'In progress';
    case FeedbackStatus.done:
      return 'Done';
    case FeedbackStatus.closed:
      return 'Closed';
  }
}
