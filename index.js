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
    console.log("🚀 Conectando con el Proxy de Bright Data...");
    
    for (const producto of misProductos) {
        try {
            console.log(`🔍 Buscando: ${producto.id}...`);
            
            // Usamos el formato de Web Unlocker de Bright Data
            const response = await axios.get(producto.url, {
                proxy: false,
                params: {
                    // Si tu cuenta usa 'brd-customer-...', se pone aquí, 
                    // pero intentemos primero con el pase directo:
                },
                headers: {
                    'apikey': apiKey
                },
                // Esta es la URL de su servidor de desbloqueo
                baseURL: 'https://api.brightdata.com/v1/web-unlocker/request'
            });

            const html = response.data;
            
            // Buscamos el precio (ejemplo: S/ 20.76)
            const regexPrecio = /S\/\s?(\d+\.\d{2})/;
            const match = html.match(regexPrecio);

            if (match) {
                const precioLimpio = parseFloat(match[1]);
                await db.collection('productos').doc(producto.id).set({
                    precioTemu: precioLimpio,
                    ultimaActualizacion: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                console.log(`✅ ${producto.id} actualizado: S/ ${precioLimpio}`);
            } else {
                console.log(`⚠️ No se leyó el precio de ${producto.id}. Temu mostró contenido protegido.`);
            }

        } catch (error) {
            console.error(`❌ Error 404 o de conexión. Revisando ruta...`);
            // Si el error persiste, Bright Data requiere que uses su proxy 
            // específico. Avísame si vuelve a salir 404.
        }
        await new Promise(r => setTimeout(r, 2000));
    }
}

procesarProductos();
