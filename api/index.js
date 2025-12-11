const axios = require('axios');

const MAIL_TM_API = 'https://api.mail.tm';

function generateRandomString(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  
  if (pathname === '/' || pathname === '') {
    return res.status(200).json({
      message: 'API Email Temporaire',
      routes: {
        'GET /temp?mail=create': 'Générer un nouvel email temporaire',
        'GET /boite?message=EMAIL&token=TOKEN': 'Récupérer la boîte de réception'
      }
    });
  }
  
  if (pathname === '/temp') {
    const mail = url.searchParams.get('mail');
    
    if (mail !== 'create') {
      return res.status(400).json({ error: 'Utilisez mail=create' });
    }
    
    try {
      const domainsResponse = await axios.get(`${MAIL_TM_API}/domains`, {
        timeout: 20000
      });
      
      const domains = domainsResponse.data['hydra:member'] || domainsResponse.data;
      
      if (!domains || domains.length === 0) {
        return res.status(500).json({ success: false, error: 'Aucun domaine disponible' });
      }
      
      const domain = domains[0].domain;
      const username = generateRandomString(10);
      const email = `${username}@${domain}`;
      const password = generateRandomString(16);
      
      await axios.post(`${MAIL_TM_API}/accounts`, {
        address: email,
        password: password
      }, { timeout: 20000 });
      
      const tokenResponse = await axios.post(`${MAIL_TM_API}/token`, {
        address: email,
        password: password
      }, { timeout: 20000 });
      
      return res.status(200).json({
        success: true,
        email: email,
        token: tokenResponse.data.token,
        password: password
      });
      
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
        details: error.response?.data
      });
    }
  }
  
  if (pathname === '/boite') {
    const message = url.searchParams.get('message');
    const token = url.searchParams.get('token');
    
    if (!message || !token) {
      return res.status(400).json({ error: 'Paramètres message et token requis' });
    }
    
    try {
      const messagesResponse = await axios.get(`${MAIL_TM_API}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: 20000
      });
      
      const messages = messagesResponse.data['hydra:member'] || [];
      
      const inbox = messages.map((msg, i) => ({
        id: msg.id || i + 1,
        from: msg.from?.address || 'Inconnu',
        subject: msg.subject || 'Sans sujet',
        date: msg.createdAt || '',
        preview: msg.intro || ''
      }));
      
      return res.status(200).json({
        success: true,
        email: message,
        inbox: inbox,
        count: inbox.length
      });
      
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  return res.status(404).json({ error: 'Route non trouvée' });
};
