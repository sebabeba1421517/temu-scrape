const admin = require('firebase-admin');
const axios = require('axios');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const token = process.env.SCRAPEDO_TOKEN;

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

const misProductos = [
    { id: 'tapones_pro_3', url: 'https://www.temu.com/pe/g-601105668136049.html' },
    { id: 'audifonos_lenovo_gm2', url: 'https://www.temu.com/pe/g-601099513328221.html' },
    { id: 'smartwatch_ultra_8', url: 'https://www.temu.com/pe/g-601099512351234.html' }
];

async function procesar() {
    console.log("--- 🚀 Iniciando Búsqueda Profunda ---");
    
    for (const p of misProductos) {
        try {
            console.log(`🔍 Escaneando: ${p.id}...`);
            const targetUrl = encodeURIComponent(p.url);
            
            // Agregamos "&render=true" para que Scrape.do espere a que cargue el JavaScript
            const apiRes = await axios.get(`https://api.scrape.do?token=${token}&url=${targetUrl}&render=true`);

            const html = apiRes.data;
            let precioEncontrado = null;

            // Intento 1: Buscar patrón S/ XX.XX
            const match1 = html.match(/S\/\s?(\d+\.\d{2})/);
            // Intento 2: Buscar en las etiquetas de meta datos (suelen ser más estables)
            const match2 = html.match(/"price":\s?"(\d+\.\d{2})"/);
            // Intento 3: Buscar precio con coma (a veces sale S/ 20,76)
            const match3 = html.match(/S\/\s?(\d+,\d{2})/);

            if (match1) precioEncontrado = match1[1];
            else if (match2) precioEncontrado = match2[1];
            else if (match3) precioEncontrado = match3[1].replace(',', '.');

            if (precioEncontrado) {
                const precioFinal = parseFloat(precioEncontrado);
                
                await db.collection('productos').doc(p.id).set({
                    precioTemu: precioFinal,
                    ultimaActualizacion: admin.firestore.FieldValue.serverTimestamp(),
                    url: p.url
                }, { merge: true });

                console.log(`✅ ${p.id}: S/ ${precioFinal}`);
            } else {
                console.log(`⚠️ Temu escondió el precio de ${p.id}. Intentando reporte de depuración...`);
                // Esto nos servirá para ver qué está viendo el robot si falla
                // console.log(html.substring(0, 500)); 
            }

        } catch (e) {
            console.error(`❌ Error en ${p.id}: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 3000)); // Pausa de seguridad
    }
    console.log("--- ✅ Fin del proceso ---");
}

procesar();
