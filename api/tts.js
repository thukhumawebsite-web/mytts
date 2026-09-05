import * as googleTTS from 'google-tts-api';

export default async function handler(req, res) {
  const { text } = req.query;

  if (!text) {
    return res.status(400).json({ error: 'Text query parameter is required' });
  }

  try {
    // MP3 အဖြစ် base64 ပြောင်းပေးသည့် free TTS link ရယူခြင်း
    const base64Audio = await googleTTS.getAudioBase64(text, {
      lang: 'en',
      slow: false,
      host: 'https://translate.google.com',
      timeout: 10000,
    });

    const buffer = Buffer.from(base64Audio, 'base64');

    // Audio stream အနေနဲ့ တိုက်ရိုက် ပြန်ပို့ပေးခြင်း
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(text)}.mp3"`);
    return res.send(buffer);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
