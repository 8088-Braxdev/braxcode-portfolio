module.exports = async function handler(req, res) {
  // 1. Kuhakikisha ni POST method tu inayokubalika
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 2. Kuweka keys kwenye array kama ulivyofanya
  const KEYS = [
    process.env.GROQ_KEY_1,
    process.env.GROQ_KEY_2,
    process.env.GROQ_KEY_3,
  ];

  // Kuchagua key moja kwa random
  const key = KEYS[Math.floor(Math.random() * KEYS.length)];

  try {
    const { messages } = req.body;

    // 3. API Call kwenda Groq
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b', // Model ID sahihi
        messages,
        max_tokens: 300,
        temperature: 0.75
      })
    });

    // 4. Kupata response na kuituma kwa user
    const data = await response.json();
    
    // Angalia kama kuna error kutoka kwenye API ya Groq
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('Groq API Error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
