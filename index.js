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
    { id: 'audifonos_lenovo_gm2', url: 'https://www.temu.com/pe/g-601099513328221.html' },
    { id: 'smartwatch_ultra_8', url: 'https://www.temu.com/pe/g-601099512351234.html' }
];

async function procesar() {
    console.log("--- 🛠️ Iniciando Extracción Avanzada ---");
    
    for (const p of misProductos) {
        try {
            console.log(`🔍 Intentando saltar bloqueo para: ${p.id}...`);
            
            // Usamos Scrape.do con parámetros extra para parecer un móvil real
            const targetUrl = encodeURIComponent(p.url);
            const apiRes = await axios.get(`https://api.scrape.do?token=${token}&url=${targetUrl}&render=true&super=true&geoCode=pe`);

            const html = apiRes.data;
            let precioFinal = null;

            // Buscamos en 4 lugares diferentes del código
            const patterns = [
                /price["']:\s?["']?(\d+\.\d{2})["']?/, // JSON de metadatos
                /["']linePriceRaw["']:\s?(\d+)/,      // Datos crudos de Temu (en céntimos)
                /S\/\s?(\d+\.\d{2})/,                 // Texto visible
                /priceContent["']:\s?["'](\d+\.\d{2})["']/ // Atributos de oferta
            ];

            for (const pattern of patterns) {
                const match = html.match(pattern);
                if (match) {
                    // Si es el patrón de céntimos (linePriceRaw), dividimos entre 100
                    precioFinal = pattern.toString().includes('linePriceRaw') ? parseFloat(match[1]) / 100 : parseFloat(match[1]);
                    if (precioFinal > 0) break;
                }
            }

            if (precioFinal) {
                await db.collection('productos').doc(p.id).set({
                    precioTemu: precioFinal,
                    ultimaActualizacion: admin.firestore.FieldValue.serverTimestamp(),
                    status: 'online'
                }, { merge: true });
                console.log(`✅ ${p.id}: S/ ${precioFinal.toFixed(2)}`);
            } else {
                console.log(`❌ Temu sigue bloqueando la IP. Intentando bypass...`);
            }

        } catch (e) {
            console.error(`❌ Error en ${p.id}: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 5000)); // Espera de 5 seg para no levantar sospechas
    }
    console.log("--- Fin ---");
}

procesar();
