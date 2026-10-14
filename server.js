// ============================================================
// Asistente Macro — Gemini (gratis) + búsqueda web opcional con Tavily (gratis)
// ============================================================
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;
const TAVILY_KEY = process.env.TAVILY_API_KEY; // opcional: sin esto, funciona igual pero sin internet
const MODEL = 'gemini-3.1-flash-lite';

if (!API_KEY) console.error('\n❌ Falta la variable de entorno GEMINI_API_KEY.');
if (!TAVILY_KEY) console.warn('ℹ️ Sin TAVILY_API_KEY: la búsqueda en internet está desactivada.');

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static('public'));

async function searchWeb(query) {
  const r = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TAVILY_KEY}` },
    body: JSON.stringify({ query, search_depth: 'basic', max_results: 5 })
  });
  if (!r.ok) throw new Error('Tavily HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const d = await r.json();
  return (d.results || []).map(x => ({
    title: x.title, url: x.url, content: (x.content || '').slice(0, 700)
  }));
}

app.post('/api/chat', async (req, res) => {
  try {
    if (!API_KEY) return res.status(500).json({ error: 'Falta GEMINI_API_KEY en el servidor.' });

    const { system, messages, webSearch } = req.body;
    if (!Array.isArray(messages)) return res.status(400).json({ error: 'Falta "messages".' });

    let fullSystem = system || '';
    let sources = [];

    // Búsqueda web (solo si está activada, hay llave y la pregunta no es un simple saludo)
    const last = messages[messages.length - 1]?.content || '';
    if (webSearch && TAVILY_KEY && last.trim().length > 12) {
      try {
        sources = await searchWeb(last.slice(0, 300));
        if (sources.length) {
          const today = new Date().toISOString().slice(0, 10);
          fullSystem += `\n\nRESULTADOS DE BÚSQUEDA WEB (consultados hoy, ${today}):\n` +
            sources.map((s, i) => `[${i + 1}] ${s.title} — ${s.url}\n${s.content}`).join('\n\n') +
            `\n\nINSTRUCCIONES PARA USAR LA WEB: usa estos resultados para datos actuales que no estén en la base del curso. ` +
            `Indica claramente qué viene de la web (menciona el sitio) y qué viene del material del curso. ` +
            `Si los resultados no responden la pregunta, dilo y no inventes cifras.`;
        }
      } catch (e) {
        console.error('Error de búsqueda web:', e.message); // si falla, seguimos sin web
        sources = [];
      }
    }

    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
    const g = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: fullSystem }] },
        contents,
        generationConfig: { maxOutputTokens: 1200 }
      })
    });

    const data = await g.json();
    if (!g.ok) {
      console.error('Error de Gemini:', JSON.stringify(data));
      return res.status(g.status).json(data);
    }

    const replyText = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    res.json({
      content: [{ type: 'text', text: replyText }],
      sources: sources.map(s => ({ title: s.title, url: s.url }))
    });
  } catch (err) {
    console.error('Error en /api/chat:', err);
    res.status(500).json({ error: 'Error interno del servidor.', detail: err.message });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));
app.listen(PORT, () => console.log(`✅ Asistente Macro corriendo en el puerto ${PORT} (web: ${TAVILY_KEY ? 'ON' : 'OFF'})`));
