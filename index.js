const puppeteer = require('puppeteer');
const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const misProductos = [
    { id: 'tapones_pro_3', name: 'Tapones Silicona AirPods', url: 'https://www.temu.com/pe/g-601105668136049.html' },
    { id: 'audifonos_lenovo_gm2', name: 'Audífonos Gamer Lenovo', url: 'https://www.temu.com/pe/g-601099513328221.html' },
    { id: 'smartwatch_ultra_8', name: 'Smartwatch Serie 8 Ultra', url: 'https://www.temu.com/pe/g-601099512351234.html' }
];

async function procesarProductos() {
    console.log(`🚀 Iniciando actualización de ${misProductos.length} productos...`);
    const browser = await puppeteer.launch({ 
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'] 
    });

    const page = await browser.newPage();
    // Disfraz premium para que Temu no nos bloquee
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    for (const producto of misProductos) {
        try {
            console.log(`🔍 Intentando con: ${producto.name}...`);
            await page.goto(producto.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            
            // Esperamos unos segundos para que cargue el precio
            await new Promise(r => setTimeout(r, 5000)); 

            // Nueva forma de sacar el precio buscando directamente el texto en la pantalla
            const precioDetectado = await page.evaluate(() => {
                // Buscamos el elemento que suele tener el precio en Temu
                const el = document.querySelector('.ecf05._90729_23_3_7'); // Clase común de precio
                return el ? el.innerText : null;
            });

            if (precioDetectado) {
                const precioLimpio = parseFloat(precioDetectado.replace(/[^\d.]/g, ''));
                await db.collection('productos').doc(producto.id).set({
                    nombre: producto.name,
                    precioTemu: precioLimpio,
                    ultimaActualizacion: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                console.log(`✅ ${producto.id}: S/ ${precioLimpio}`);
            } else {
                console.log(`❌ No se encontró el precio para ${producto.name}. Temu bloqueó la vista.`);
            }

            await new Promise(r => setTimeout(r, 6000)); // Pausa más larga para ser "humanos"

        } catch (error) {
            console.error(`❌ Error en ${producto.id}:`, error.message);
        }
    }
    await browser.close();
}

procesarProductos();
