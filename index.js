const puppeteer = require('puppeteer');
const admin = require('firebase-admin');

// Configuración de la llave de GitHub Secrets
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

// --- TU LISTA DE PRODUCTOS SELECCIONADOS ---
const misProductos = [
    { 
        id: 'tapones_pro_3', 
        name: 'Tapones Silicona AirPods',
        url: 'https://www.temu.com/pe/g-601105668136049.html' 
    },
    { 
        id: 'audifonos_lenovo_gm2', 
        name: 'Audífonos Gamer Lenovo',
        url: 'https://www.temu.com/pe/g-601099513328221.html' 
    },
    { 
        id: 'smartwatch_ultra_8', 
        name: 'Smartwatch Serie 8 Ultra',
        url: 'https://www.temu.com/pe/g-601099512351234.html' 
    },
    { 
        id: 'proyector_portatil_hd', 
        name: 'Mini Proyector LED',
        url: 'https://www.temu.com/pe/g-601099538827110.html' 
    },
    { 
        id: 'mouse_gamer_rgb', 
        name: 'Mouse Inalámbrico Recargable',
        url: 'https://www.temu.com/pe/g-601099515543210.html' 
    }
];

async function procesarProductos() {
    console.log(`🚀 Iniciando actualización de ${misProductos.length} productos...`);
    
    const browser = await puppeteer.launch({ 
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    for (const producto of misProductos) {
        try {
            console.log(`🔍 Scrapeando: ${producto.name}...`);
            // Navegar al producto
            await page.goto(producto.url, { waitUntil: 'networkidle2', timeout: 60000 });

            // Extraer el objeto de datos de Temu
            const rawData = await page.evaluate(() => window.rawData);

            if (rawData && rawData.store && rawData.store.priceModule) {
                const precioStr = rawData.store.priceModule.data.goodsSalePriceRich.ariaLabel;
                const precioLimpio = parseFloat(precioStr.replace(/[^\d.]/g, ''));

                // Actualizar Firestore
                await db.collection('productos').doc(producto.id).set({
                    nombre: producto.name,
                    precioTemu: precioLimpio,
                    urlCompra: producto.url,
                    ultimaActualizacion: admin.firestore.FieldValue.serverTimestamp(),
                    moneda: 'PEN'
                }, { merge: true });

                console.log(`✅ Actualizado: ${producto.id} -> S/ ${precioLimpio}`);
            } else {
                console.log(`⚠️ No se pudo obtener el precio de: ${producto.name}`);
            }
            
            // Espera de 4 segundos para evitar que Temu nos bloquee por sospechosos
            await new Promise(r => setTimeout(r, 4000)); 

        } catch (error) {
            console.error(`❌ Error en ${producto.id}:`, error.message);
        }
    }

    await browser.close();
    console.log("--- ✅ Catálogo actualizado correctamente en Firebase ---");
}

procesarProductos();
