const admin = require('firebase-admin');
const axios = require('axios');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const apiKey = process.env.BRIGHTDATA_API_KEY;

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const misProductos = [
    { id: 'tapones_pro_3', url: 'https://www.temu.com/pe/g-601105668136049.html' },
    { id: 'audifonos_lenovo_gm2', url: 'https://www.temu.com/pe/g-601099513328221.html' }
];

async function procesarProductos() {
    console.log("🚀 Usando Bright Data para saltar el bloqueo de Temu...");
    
    for (const producto of misProductos) {
        try {
            console.log(`🔍 Extrayendo precio de: ${producto.id}...`);
            
            // Bright Data usará proxies residenciales (IPs de casas reales)
            const response = await axios.get('https://api.brightdata.com/request', {
                params: {
                    url: producto.url,
                    token: apiKey
                }
            });

            const html = response.data;
            
            // Buscamos el precio con Regex (S/ seguido de números)
            const regexPrecio = /S\/\s?(\d+\.\d{2})/;
            const match = html.match(regexPrecio);

            if (match) {
                const precioLimpio = parseFloat(match[1]);
                await db.collection('productos').doc(producto.id).set({
                    precioTemu: precioLimpio,
                    ultimaActualizacion: admin.firestore.FieldValue.serverTimestamp(),
                    fuente: 'Temu (via BrightData)'
                }, { merge: true });
                console.log(`✅ ${producto.id} actualizado: S/ ${precioLimpio}`);
            } else {
                console.log(`❌ Temu cambió el formato o bloqueó la respuesta para ${producto.id}`);
            }

        } catch (error) {
            console.error(`❌ Error en la conexión con Bright Data:`, error.message);
        }
        await new Promise(r => setTimeout(r, 2000));
    }
}

procesarProductos();
