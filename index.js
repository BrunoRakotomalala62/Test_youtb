const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 5000;

const MAIL_TM_API = 'https://api.mail.tm';

const axiosInstance = axios.create({
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 30000
});

function generateRandomString(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

app.get('/temp', async (req, res) => {
  const { mail } = req.query;
  
  if (mail !== 'create') {
    return res.status(400).json({ error: 'Paramètre invalide. Utilisez mail=create' });
  }
  
  try {
    const domainsResponse = await axiosInstance.get(`${MAIL_TM_API}/domains`);
    const domains = domainsResponse.data['hydra:member'] || domainsResponse.data;
    
    if (!domains || domains.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Aucun domaine disponible'
      });
    }
    
    const domain = domains[0].domain;
    const username = generateRandomString(10);
    const email = `${username}@${domain}`;
    const password = generateRandomString(16);
    
    await axiosInstance.post(`${MAIL_TM_API}/accounts`, {
      address: email,
      password: password
    });
    
    const tokenResponse = await axiosInstance.post(`${MAIL_TM_API}/token`, {
      address: email,
      password: password
    });
    
    const token = tokenResponse.data.token;
    
    res.json({
      success: true,
      email: email,
      token: token,
      password: password,
      info: 'Conservez le token pour récupérer la boîte de réception avec /boite?message=EMAIL&token=TOKEN'
    });
    
  } catch (error) {
    console.error('Error creating email:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

app.get('/boite', async (req, res) => {
  const { message, token } = req.query;
  
  if (!message || !message.includes('@')) {
    return res.status(400).json({ 
      error: 'Paramètre invalide. Fournissez un email valide avec message=EMAIL&token=TOKEN' 
    });
  }
  
  if (!token) {
    return res.status(400).json({ 
      error: 'Token manquant. Utilisez /boite?message=EMAIL&token=TOKEN'
    });
  }
  
  try {
    const messagesResponse = await axiosInstance.get(`${MAIL_TM_API}/messages`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const messages = messagesResponse.data['hydra:member'] || messagesResponse.data || [];
    
    const inbox = messages.map((msg, index) => ({
      id: msg.id || index + 1,
      from: msg.from?.address || msg.from || 'Inconnu',
      subject: msg.subject || 'Sans sujet',
      date: msg.createdAt || msg.date || '',
      preview: msg.intro || msg.text?.substring(0, 200) || '',
      isRead: msg.seen || false
    }));
    
    res.json({
      success: true,
      email: message,
      inbox: inbox,
      count: inbox.length
    });
    
  } catch (error) {
    console.error('Error fetching inbox:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      return res.status(401).json({
        success: false,
        error: 'Token invalide ou expiré. Veuillez recréer un email avec /temp?mail=create'
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

app.get('/message/:id', async (req, res) => {
  const { id } = req.params;
  const { email, token } = req.query;
  
  if (!email || !email.includes('@')) {
    return res.status(400).json({ 
      error: 'Paramètre email invalide' 
    });
  }
  
  if (!token) {
    return res.status(400).json({ 
      error: 'Token manquant'
    });
  }
  
  try {
    const messageResponse = await axiosInstance.get(`${MAIL_TM_API}/messages/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const msg = messageResponse.data;
    
    res.json({
      success: true,
      message: {
        id: msg.id,
        from: msg.from?.address || msg.from,
        to: msg.to?.[0]?.address || email,
        subject: msg.subject || 'Sans sujet',
        date: msg.createdAt || '',
        text: msg.text || '',
        html: msg.html || [],
        attachments: msg.attachments || []
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.response?.data?.message || error.message
    });
  }
});

app.get('/', (req, res) => {
  res.json({
    message: 'API Email Temporaire',
    description: 'API pour générer des emails temporaires et récupérer la boîte de réception',
    routes: {
      'GET /temp?mail=create': 'Générer un nouvel email temporaire (retourne email + token)',
      'GET /boite?message=EMAIL&token=TOKEN': 'Récupérer la boîte de réception',
      'GET /message/:id?email=EMAIL&token=TOKEN': 'Lire le contenu complet d\'un message'
    },
    exemple: {
      creer_email: '/temp?mail=create',
      voir_boite: '/boite?message=exemple@domain.com&token=VOTRE_TOKEN',
      lire_message: '/message/MESSAGE_ID?email=exemple@domain.com&token=VOTRE_TOKEN'
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur API Email Temporaire démarré sur http://0.0.0.0:${PORT}`);
});

module.exports = app;
