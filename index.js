const admin = require('firebase-admin');
const axios = require('axios');

// 1. Configuración de Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const token = process.env.SCRAPEDO_TOKEN;

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

// 2. Tu lista de productos de Temu
const misProductos = [
    { id: 'tapones_pro_3', url: 'https://www.temu.com/pe/g-601105668136049.html' },
    { id: 'audifonos_lenovo_gm2', url: 'https://www.temu.com/pe/g-601099513328221.html' },
    { id: 'smartwatch_ultra_8', url: 'https://www.temu.com/pe/g-601099512351234.html' }
];

async function procesar() {
    console.log("--- Inicio del proceso ---");
    
    if (!token) {
        console.error("❌ ERROR: El SCRAPEDO_TOKEN no se detectó en el entorno.");
        return;
    }

    for (const p of misProductos) {
        try {
            console.log(`🔍 Consultando precio para: ${p.id}...`);
            
            // Usamos Scrape.do para evitar que Temu nos bloquee
            const targetUrl = encodeURIComponent(p.url);
            const apiRes = await axios.get(`https://api.scrape.do?token=${token}&url=${targetUrl}`);

            // Buscamos el patrón "S/ XX.XX" en el código de la página
            const match = apiRes.data.match(/S\/\s?(\d+\.\d{2})/);

            if (match) {
                const precio = parseFloat(match[1]);
                
                // Guardamos en Firebase
                await db.collection('productos').doc(p.id).set({
                    precioTemu: precio,
                    ultimaActualizacion: admin.firestore.FieldValue.serverTimestamp(),
                    moneda: 'PEN',
                    enlace: p.url
                }, { merge: true });

                console.log(`✅ ${p.id} actualizado con éxito: S/ ${precio}`);
            } else {
                console.log(`⚠️ No se encontró el precio en el HTML de ${p.id}.`);
            }

        } catch (e) {
            console.error(`❌ Error en ${p.id}: ${e.message}`);
        }
        
        // Pausa de 2 segundos para no saturar la API
        await new Promise(r => setTimeout(r, 2000));
    }
    console.log("--- Proceso terminado ---");
}

procesar();
