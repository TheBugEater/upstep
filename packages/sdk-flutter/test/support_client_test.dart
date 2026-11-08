import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:upstep_flutter/upstep_flutter.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));
  test(
    'native chat exchanges signed identities and preserves idempotent message IDs',
    () async {
      final bodies = <Map<String, dynamic>>[];
      final client = SupportClient(
        const UpstepConfig(
          apiKey: 'public-key',
          supportIdentityToken: 'signed-identity',
        ),
        client: MockClient((request) async {
          final body = request.body.isEmpty
              ? <String, dynamic>{}
              : jsonDecode(request.body) as Map<String, dynamic>;
          bodies.add(body);
          if (request.url.path.endsWith('/support')) {
            return http.Response(jsonEncode({'token': 'opaque-session'}), 200);
          }
          expect(request.headers['Authorization'], 'Bearer opaque-session');
          if (request.method == 'GET') {
            return http.Response(jsonEncode({'conversations': []}), 200);
          }
          return http.Response('{}', 200);
        }),
      );
      await Future.wait([client.conversations(), client.conversations()]);
      expect(
        bodies.where((b) => b['identityToken'] == 'signed-identity').length,
        1,
      );
      expect((await SharedPreferences.getInstance()).getKeys(), isEmpty);
      await client.send(
        'one',
        'My order is missing',
        clientMessageId: 'fixed-message-id',
      );
      expect(bodies.last['clientMessageId'], 'fixed-message-id');
      await client.handoff('one', 'Taylor', 'businesscodepulse@gmail.com');
      expect(bodies.last['action'], 'handoff');
      expect(bodies.last['name'], 'Taylor');
      client.dispose();
    },
  );
  test('paid plan failures hide chat without breaking feedback', () async {
    final client = SupportClient(
      const UpstepConfig(apiKey: 'public-key'),
      client: MockClient(
        (_) async => http.Response('{"error":"Paid plan required"}', 402),
      ),
    );
    expect(await client.configuration(), isNull);
    client.dispose();
  });
  testWidgets(
    'native support starts with readable text and no premature team request',
    (tester) async {
      final client = SupportClient(
        const UpstepConfig(apiKey: 'public-key'),
        client: MockClient(
          (request) async => http.Response(
            jsonEncode(
              request.url.path.endsWith('/support')
                  ? {'token': 'session'}
                  : {'conversations': []},
            ),
            200,
          ),
        ),
      );
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(
            colorScheme: ColorScheme.fromSeed(
              seedColor: const Color(0xFF3366CC),
            ).copyWith(primary: const Color(0xFF3366CC)),
          ),
          home: Scaffold(
            body: SupportChat(
              client: client,
              configuration: const {
                'businessName': 'Acme',
                'welcomeMessage': 'How can we help?',
                'logoUrl':
                    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6rNwAAAAASUVORK5CYII=',
              },
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<IconButton>(find.byType(IconButton))
            .style
            ?.backgroundColor
            ?.resolve({}),
        const Color(0xFF3366CC),
      );
      expect(find.text('Acme'), findsOneWidget);
      expect(
        tester.widget<Image>(find.byType(Image)).image,
        isA<MemoryImage>(),
      );
      expect(find.text('Ask the team'), findsNothing);
      expect(
        tester.widget<TextField>(find.byType(TextField)).style?.fontSize,
        15,
      );
      await tester.pumpWidget(const SizedBox());
      client.dispose();
    },
  );
  testWidgets('team card requires contact details before sending a request', (
    tester,
  ) async {
    var handoffs = 0;
    final conversation = {
      'id': 'one',
      'state': 'AI',
      'messages': [
        ...List.generate(
          25,
          (i) => {
            'id': 'old-$i',
            'role': 'CUSTOMER',
            'authorName': 'Visitor',
            'content': 'Earlier message $i.',
          },
        ),
        {
          'id': 'answer',
          'role': 'ASSISTANT',
          'authorName': 'Acme AI',
          'content': 'The team needs to check this issue.',
          'metadata': {
            'widgets': [
              {
                'id': 'contact:one',
                'type': 'contact_form',
                'title': 'Let the team follow up',
                'summary': 'Order has not arrived after the promised date.',
              },
            ],
          },
        },
      ],
      'activeWidgetMessageId': 'answer',
      'canEscalate': true,
      'customer': {'name': null, 'email': null, 'verified': false},
    };
    final client = SupportClient(
      const UpstepConfig(apiKey: 'public-key'),
      client: MockClient((request) async {
        if (request.url.path.endsWith('/support')) {
          return http.Response('{"token":"session"}', 200);
        }
        if (request.url.path.endsWith('/conversations')) {
          return http.Response(
            '{"conversations":[{"id":"one","state":"AI"}]}',
            200,
          );
        }
        if (request.method == 'POST') {
          handoffs++;
          return http.Response('{}', 200);
        }
        return http.Response(jsonEncode(conversation), 200);
      }),
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SupportChat(
            client: client,
            configuration: const {'businessName': 'Acme'},
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ask the team'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(handoffs, 0);
    expect(find.text('Please enter Your name'), findsOneWidget);
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Your name'),
      'Taylor Customer',
    );
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Email address'),
      'businesscodepulse@gmail.com',
    );
    await tester.ensureVisible(find.text('Send to the team'));
    await tester.tap(find.text('Send to the team'));
    await tester.pumpAndSettle();
    expect(handoffs, 1);
    await tester.pumpWidget(const SizedBox());
    client.dispose();
  });
}
