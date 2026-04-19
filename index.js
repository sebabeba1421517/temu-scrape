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

// --- CONFIGURACIÓN DE TU LISTA DE PRODUCTOS ---
const misProductos = [
    { 
        id: 'tapones_pro_3', 
        url: 'https://www.temu.com/pe/g-601105668136049.html' 
    },
    { 
        id: 'smartwatch_deportivo', 
        url: 'https://www.temu.com/pe/g-601105586614767.html' 
    },
    // Puedes seguir agregando más aquí abajo:
    // { id: 'nombre_en_firebase', url: 'link_de_temu' },
];

async function procesarProductos() {
    console.log(`Iniciando actualización de ${misProductos.length} productos...`);
    
    const browser = await puppeteer.launch({ 
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    for (const producto of misProductos) {
        try {
            console.log(`Scrapeando: ${producto.id}...`);
            await page.goto(producto.url, { waitUntil: 'networkidle2', timeout: 60000 });

            const rawData = await page.evaluate(() => window.rawData);

            if (rawData) {
                const precioStr = rawData.store.priceModule.data.goodsSalePriceRich.ariaLabel;
                const precioLimpio = parseFloat(precioStr.replace(/[^\d.]/g, ''));

                await db.collection('productos').doc(producto.id).set({
                    precioTemu: precioLimpio,
                    ultimaActualizacion: admin.firestore.FieldValue.serverTimestamp(),
                    enOferta: true
                }, { merge: true });

                console.log(`✅ ${producto.id} actualizado a S/ ${precioLimpio}`);
            }
            
            // Un pequeño descanso entre productos para no ser bloqueados
            await new Promise(r => setTimeout(r, 3000)); 

        } catch (error) {
            console.error(`❌ Error en ${producto.id}:`, error.message);
        }
    }

    await browser.close();
    console.log("--- Proceso terminado ---");
}

procesarProductos();
