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
    for (const p of misProductos) {
        try {
            console.log(`🔍 Consultando ${p.id}...`);
            
            // Scrape.do se encarga de saltar el bloqueo de Temu
            const targetUrl = encodeURIComponent(p.url);
            const apiRes = await axios.get(`https://api.scrape.do?token=${token}&url=${targetUrl}`);

            // Buscamos el precio en el HTML con una expresión regular
            // Temu suele ponerlo como "S/ 20.76" o "S/20.76"
            const match = apiRes.data.match(/S\/\s?(\d+\.\d{2})/);

            if (match) {
                const precio = parseFloat(match[1]);
                await db.collection('productos').doc(p.id).set({
                    precioTemu: precio,
                    ultimaActualizacion: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                console.log(`✅ ${p.id}: S/ ${precio}`);
            } else {
                console.log(`❌ No se halló precio en ${p.id}. Probando otro método...`);
            }
        } catch (e) {
            console.error(`Error en ${p.id}:`, e.message);
        }
    }
}

procesar();
