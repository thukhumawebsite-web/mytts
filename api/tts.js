import * as googleTTS from 'google-tts-api';

export default async function handler(req, res) {
  const { text, lang = 'en', tld = 'com', speed = '1' } = req.query;

  if (!text) {
    return res.status(400).json({ error: 'Text query parameter is required' });
  }

  try {
    const isSlow = speed === '0.5';
    const host = `https://translate.google.${tld}`;

    const base64Audio = await googleTTS.getAudioBase64(text, {
      lang: lang,
      slow: isSlow,
      host: host,
      timeout: 10000,
    });

    const buffer = Buffer.from(base64Audio, 'base64');

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `inline; filename="tts.mp3"`);
    return res.send(buffer);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
