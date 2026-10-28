// A campaign message may start with an audio tag on its own line:
//   [audio:https://example.com/voice.m4a]
// The audio is sent first, as a voice-style audio message, then the rest of
// the text. Without a tag the message is unchanged.
const AUDIO_TAG = /^\s*\[audio:(https:\/\/[^\s\]]+)\]\s*\n?/i;

export function extractAudioTag(message: string): {
  audioUrl: string | null;
  text: string;
} {
  const match = message.match(AUDIO_TAG);
  if (!match) return { audioUrl: null, text: message };
  return { audioUrl: match[1], text: message.slice(match[0].length).trim() };
}
