// ============================================================
// Servidor del Asistente Macro — usa GOOGLE GEMINI (gratis, sin tarjeta)
// ============================================================
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-3.1-flash-lite';

if (!API_KEY) {
  console.error('\n❌ Falta la variable de entorno GEMINI_API_KEY.');
}

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static('public'));

app.post('/api/chat', async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({ error: 'El servidor no tiene configurada la variable GEMINI_API_KEY.' });
    }
    const { system, messages } = req.body;
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'Formato inválido: falta "messages".' });
    }

    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

    const geminiResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system || '' }] },
        contents,
        generationConfig: { maxOutputTokens: 1000 }
      })
    });

    const data = await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error('Error de Gemini:', JSON.stringify(data));
      return res.status(geminiResponse.status).json(data);
    }

    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.json({ content: [{ type: 'text', text: replyText }] });

  } catch (err) {
    console.error('Error en /api/chat:', err);
    res.status(500).json({ error: 'Error interno del servidor.', detail: err.message });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`✅ Servidor del Asistente Macro (Gemini) corriendo en el puerto ${PORT}`);
});
