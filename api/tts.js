export default async function handler(req, res) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { text, voice = 'Puck' } = req.query;

  if (!text) {
    return res.status(400).json({ error: 'Text query parameter is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not set in Vercel Environment Variables' });
  }

  // Model variants to try
  const models = [
    'gemini-2.0-flash',
    'gemini-2.5-flash-preview-tts',
    'gemini-2.0-flash-exp'
  ];

  const payload = {
    contents: [{
      role: 'user',
      parts: [{
        text: `Please read the following text aloud with accurate, natural pronunciation. English terms, acronyms, and loanwords inside Burmese text should be pronounced accurately in standard English: ${text}`
      }]
    }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voice
          }
        }
      }
    }
  };

  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        lastError = data.error?.message || `Failed with status ${response.status}`;
        continue;
      }

      const candidate = data.candidates?.[0];
      const part = candidate?.content?.parts?.find(p => p.inlineData && p.inlineData.mimeType?.startsWith('audio/'));

      if (!part || !part.inlineData?.data) {
        lastError = 'No audio part returned in response';
        continue;
      }

      const pcmBuffer = Buffer.from(part.inlineData.data, 'base64');
      const wavBuffer = addWavHeader(pcmBuffer, 24000, 1, 16);

      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Disposition', 'inline; filename="speech.wav"');
      return res.send(wavBuffer);
    } catch (err) {
      lastError = err.message;
    }
  }

  return res.status(500).json({ error: `All TTS models failed. Last error: ${lastError}` });
}

function addWavHeader(samples, sampleRate = 24000, numChannels = 1, bitDepth = 16) {
  const byteRate = (sampleRate * numChannels * bitDepth) / 8;
  const blockAlign = (numChannels * bitDepth) / 8;
  const buffer = Buffer.alloc(44 + samples.length);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + samples.length, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitDepth, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples.length, 40);
  samples.copy(buffer, 44);

  return buffer;
}
