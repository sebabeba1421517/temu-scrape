const puppeteer = require('puppeteer');
const admin = require('firebase-admin');

// GitHub Actions inyectará la llave desde los Secrets
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function actualizarPrecioTemu(urlProducto, idEnTuWeb) {
    console.log(`Iniciando actualización para: ${idEnTuWeb}`);
    
    const browser = await puppeteer.launch({ 
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    
    const page = await browser.newPage();
    // User-Agent para parecer un humano
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        await page.goto(urlProducto, { waitUntil: 'networkidle2', timeout: 60000 });

        // Extraemos los datos internos de la página
        const rawData = await page.evaluate(() => window.rawData);

        if (rawData) {
            const precioOfertaStr = rawData.store.priceModule.data.goodsSalePriceRich.ariaLabel;
            // Convertimos "S/ 20.76" a número 20.76
            const precioLimpio = parseFloat(precioOfertaStr.replace(/[^\d.]/g, ''));

            console.log(`Precio detectado: S/ ${precioLimpio}`);

            // Actualizamos tu base de datos en la colección 'productos'
            await db.collection('productos').doc(idEnTuWeb).set({
                precioTemu: precioLimpio,
                urlOriginal: urlProducto,
                ultimaActualizacion: admin.firestore.FieldValue.serverTimestamp(),
                enOferta: true
            }, { merge: true });

            console.log("¡Base de datos actualizada con éxito!");
        } else {
            console.log("Error: No se pudo leer el objeto rawData de Temu.");
        }
    } catch (error) {
        console.error("Hubo un error en el scraping:", error);
    } finally {
        await browser.close();
    }
}

// CONFIGURACIÓN FINAL: Link limpio e ID del producto
actualizarPrecioTemu('https://www.temu.com/pe/g-601105668136049.html', 'tapones_pro_3');
