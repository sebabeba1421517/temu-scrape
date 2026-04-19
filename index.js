const admin = require('firebase-admin');
const axios = require('axios');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const token = process.env.SCRAPEDO_TOKEN;

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const misProductos = [
    { id: 'tapones_pro_3', url: 'https://www.temu.com/pe/g-601105668136049.html' },
    { id: 'audifonos_lenovo_gm2', url: 'https://www.temu.com/pe/g-601099513328221.html' }
];

async function procesar() {
    if (!token) {
        console.error("❌ ERROR: El SCRAPEDO_TOKEN no está configurado en los Secrets de GitHub.");
        return;
    }
    
    for (const p of misProductos) {
        try {
            console.log(`🔍 Consultando ${p.id}...`);
            const targetUrl = encodeURIComponent(p.url);
            
            // Llamada a la API de Scrape.do
            const response = await axios.get(`https://api.scrape.do?token=${token}&url=${targetUrl}`);

            // Buscamos el precio en el HTML
            const match = response.data.match(/S\/\s?(\d+\.\d{2})/);

            if (match) {
                const precio = parseFloat(match[1]);
                await db.collection('productos').doc(p.id).set({
                    precioTemu: precio,
                    ultimaActualizacion: admin.firestore.FieldValue.serverTimestamp(),
                    estado: 'actualizado'
                }, { merge: true });
                console.log(`✅ ${p.id}: S/ ${precio}`);
            } else {
                console.log(`⚠️ No se halló precio en el HTML de ${p.id}. Puede que el producto esté agotado.`);
            }
        } catch (e) {
            // Aquí capturamos el error 401 que te salió
            console.error(`❌ Error en ${p.id}: ${e.response ? e.response.status : e.message}`);
        }
        await new Promise(r => setTimeout(r, 1000));
    }
}

procesar();
