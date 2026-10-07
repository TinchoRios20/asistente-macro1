// ============================================================
// Servidor del Asistente Macro — listo para desplegar en Render
// ============================================================
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000; // Render asigna el puerto automáticamente
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error('\n❌ Falta la variable de entorno ANTHROPIC_API_KEY.');
  console.error('   En Render: ve a tu servicio -> Environment -> Add Environment Variable.\n');
}

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static('public'));

app.post('/api/chat', async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({ error: 'El servidor no tiene configurada la API key (ANTHROPIC_API_KEY).' });
    }

    const { system, messages } = req.body;
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'Formato inválido: falta "messages".' });
    }

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: system || '',
        messages
      })
    });

    const data = await anthropicResponse.json();

    if (!anthropicResponse.ok) {
      console.error('Error de Anthropic:', JSON.stringify(data));
      return res.status(anthropicResponse.status).json(data);
    }

    res.json(data);
  } catch (err) {
    console.error('Error en /api/chat:', err);
    res.status(500).json({ error: 'Error interno del servidor.', detail: err.message });
  }
});

// Ruta de salud, útil para confirmar que el servidor está vivo
app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`✅ Servidor del Asistente Macro corriendo en el puerto ${PORT}`);
});
