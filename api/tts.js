export default async function handler(req, res) {
  const { text, voice = 'Puck' } = req.query;

  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in Vercel' });
  }

  try {
    // gemini-3.6-flash သို့ ပြောင်းထားပါသည်
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [{
        parts: [{
          text: `You are a text-to-speech reader. Read the following text aloud with completely natural pronunciation. When encountering English loanwords, acronyms, or mixed English phrases within Burmese text, pronounce both languages clearly and accurately:\n\n${text}`
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

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Gemini API error' });
    }

    const candidate = data.candidates?.[0];
    const part = candidate?.content?.parts?.find(p => p.inlineData && p.inlineData.mimeType?.startsWith('audio/'));

    if (!part) {
      return res.status(500).json({ error: 'No audio returned from Gemini' });
    }

    const pcmBuffer = Buffer.from(part.inlineData.data, 'base64');
    const mimeType = part.inlineData.mimeType || '';

    // PCM အသံ stream ကို browser က တိုက်ရိုက်ဖွင့်နိုင်ရန် WAV Header ထည့်သွင်းခြင်း
    let finalBuffer = pcmBuffer;
    if (mimeType.includes('pcm') || mimeType.includes('L16') || !mimeType.includes('wav')) {
      finalBuffer = addWavHeader(pcmBuffer, 24000, 1, 16);
    }

    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Disposition', 'inline; filename="speech.wav"');
    return res.send(finalBuffer);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
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
  buffer.writeUInt16LE(1, 20);
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
