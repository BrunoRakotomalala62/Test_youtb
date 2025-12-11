const express = require('express');
const axios = require('axios');

const app = express();
const PORT = 5000;

const MAIL_TM_API = 'https://api.mail.tm';

const axiosInstance = axios.create({
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 30000
});

const activeEmails = new Map();

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
    
    const accountResponse = await axiosInstance.post(`${MAIL_TM_API}/accounts`, {
      address: email,
      password: password
    });
    
    const tokenResponse = await axiosInstance.post(`${MAIL_TM_API}/token`, {
      address: email,
      password: password
    });
    
    const token = tokenResponse.data.token;
    const accountId = accountResponse.data.id;
    
    activeEmails.set(email, {
      token: token,
      accountId: accountId,
      password: password,
      createdAt: new Date().toISOString()
    });
    
    res.json({
      success: true,
      email: email,
      token: token,
      info: 'Email temporaire créé avec succès. Utilisez /boite?message=EMAIL pour voir les messages reçus.'
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
  const { message } = req.query;
  
  if (!message || !message.includes('@')) {
    return res.status(400).json({ 
      error: 'Paramètre invalide. Fournissez un email valide avec message=EMAIL' 
    });
  }
  
  try {
    const emailData = activeEmails.get(message);
    
    if (!emailData) {
      return res.status(404).json({
        success: false,
        error: 'Email non trouvé. Vous devez d\'abord créer l\'email avec /temp?mail=create',
        hint: 'Les emails générés précédemment dans une autre session ne sont plus accessibles.'
      });
    }
    
    const messagesResponse = await axiosInstance.get(`${MAIL_TM_API}/messages`, {
      headers: {
        'Authorization': `Bearer ${emailData.token}`
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
      activeEmails.delete(message);
      return res.status(401).json({
        success: false,
        error: 'Session expirée. Veuillez recréer un email avec /temp?mail=create'
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
  const { email } = req.query;
  
  if (!email || !email.includes('@')) {
    return res.status(400).json({ 
      error: 'Paramètre email invalide' 
    });
  }
  
  try {
    const emailData = activeEmails.get(email);
    
    if (!emailData) {
      return res.status(404).json({
        success: false,
        error: 'Email non trouvé'
      });
    }
    
    const messageResponse = await axiosInstance.get(`${MAIL_TM_API}/messages/${id}`, {
      headers: {
        'Authorization': `Bearer ${emailData.token}`
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
      'GET /temp?mail=create': 'Générer un nouvel email temporaire',
      'GET /boite?message=EMAIL': 'Récupérer la boîte de réception pour un email donné',
      'GET /message/:id?email=EMAIL': 'Lire le contenu complet d\'un message'
    },
    exemple: {
      creer_email: '/temp?mail=create',
      voir_boite: '/boite?message=exemple@domain.com',
      lire_message: '/message/MESSAGE_ID?email=exemple@domain.com'
    },
    note: 'Les emails sont stockés en mémoire et seront perdus au redémarrage du serveur.'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur API Email Temporaire démarré sur http://0.0.0.0:${PORT}`);
  console.log('Routes disponibles:');
  console.log('  GET /temp?mail=create - Générer un email temporaire');
  console.log('  GET /boite?message=EMAIL - Récupérer la boîte de réception');
  console.log('  GET /message/:id?email=EMAIL - Lire un message');
});
