// Mock the streaming service so tests remain deterministic
jest.mock('../service/aiService', () => ({
  generateTextWithStreaming: jest.fn(async (_prompt: string, onChunk: any, onComplete: any) => {
    // Simulate a small stream
    onChunk('Hello');
    onChunk(' world');
    onComplete('Hello world');
    return Promise.resolve();
  }),
}));

import { generateTextWithStreaming } from '../service/aiService';
import { generateTextFromPrompt } from '../generate-text-extension';

describe('generateTextFromPrompt', () => {
  test('uses explicit insert position when provided', async () => {
    const dispatched: any[] = [];

    // Minimal mock editor implementing the API used by the function
    const insertSpy = jest.fn();

    const editor: any = {
      state: {
        // selection.from should be ignored when insertAt is provided
        selection: { from: 999 },
        tr: {
          setMeta: (_key: any, meta: any) => {
            // Return an object that view.dispatch will receive
            return { _meta: meta };
          },
        },
      },
      view: {
        dispatch: (v: any) => dispatched.push(v),
      },
      chain: () => ({
        focus: () => ({
          insertContentAt: (pos: number, content: string) => ({
            run: () => insertSpy(pos, content),
          }),
          run: () => {},
        }),
      }),
    };

    // Call using an explicit insert position
    const explicitPos = 123;

    await generateTextFromPrompt(editor as any, 'my prompt', undefined, [], 'doc-id', explicitPos);

    // generateTextWithStreaming should have been invoked
    expect(generateTextWithStreaming).toHaveBeenCalled();

    // The stream preview should use the explicit position as the initial pos
    expect(dispatched.length).toBeGreaterThan(0);
    expect(dispatched[0]).toEqual({ _meta: { pos: explicitPos, text: '' } });

    // Final insertion should have used the explicit position and converted text to HTML
    expect(insertSpy).toHaveBeenCalled();
    const [pos, content] = insertSpy.mock.calls[0];
    expect(pos).toBe(explicitPos);
    expect(content).toContain('Hello world');
  });
});
