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
    console.log("--- 🚀 Iniciando Extracción de Metadatos ---");
    
    for (const p of misProductos) {
        try {
            console.log(`🔍 Analizando código de: ${p.id}...`);
            
            // Usamos Scrape.do con render=true para que Temu suelte los datos
            const targetUrl = encodeURIComponent(p.url);
            const apiRes = await axios.get(`https://api.scrape.do?token=${token}&url=${targetUrl}&render=true`);

            const html = apiRes.data;
            let precioFinal = null;

            // MÉTODO 1: Buscar en el objeto "goodsSalePrice" (Formato JSON interno de Temu)
            const regexPrecioJSON = /"goodsSalePrice":\s?(\d+)/; 
            const matchJSON = html.match(regexPrecioJSON);

            if (matchJSON) {
                // Temu a veces manda el precio en céntimos (ej: 2076 en vez de 20.76)
                precioFinal = parseFloat(matchJSON[1]) / 100;
            } else {
                // MÉTODO 2: Buscar el precio en el texto plano si el JSON falla
                const matchTexto = html.match(/S\/\s?(\d+\.\d{2})/);
                if (matchTexto) precioFinal = parseFloat(matchTexto[1]);
            }

            if (precioFinal && precioFinal > 0) {
                await db.collection('productos').doc(p.id).set({
                    precioTemu: precioFinal,
                    ultimaActualizacion: admin.firestore.FieldValue.serverTimestamp(),
                    url: p.url,
                    status: 'online'
                }, { merge: true });

                console.log(`✅ ${p.id}: S/ ${precioFinal.toFixed(2)}`);
            } else {
                console.log(`⚠️ No se detectó precio válido para ${p.id}. Temu podría estar solicitando verificación humana.`);
            }

        } catch (e) {
            console.error(`❌ Error en ${p.id}: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 4000)); // Pausa más larga
    }
    console.log("--- ✅ Fin del proceso ---");
}

procesar();
