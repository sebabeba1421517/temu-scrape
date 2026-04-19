const puppeteer = require('puppeteer');
const admin = require('firebase-admin');

// GitHub Actions inyectará la llave aquí
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function actualizarPrecioTemu(urlProducto, idEnTuWeb) {
    console.log(`Iniciando búsqueda para: ${idEnTuWeb}`);
    
    const browser = await puppeteer.launch({ 
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        await page.goto(urlProducto, { waitUntil: 'networkidle2', timeout: 60000 });

        const rawData = await page.evaluate(() => window.rawData);

        if (rawData) {
            const precioOfertaStr = rawData.store.priceModule.data.goodsSalePriceRich.ariaLabel;
            const precioLimpio = parseFloat(precioOfertaStr.replace(/[^\d.]/g, ''));

            console.log(`Precio extraído: S/ ${precioLimpio}`);

            // Actualiza tu Firestore (asegúrate de que la colección y el ID coincidan)
            await db.collection('productos').doc(idEnTuWeb).set({
                precioTemu: precioLimpio,
                ultimaActualizacion: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            console.log("¡Firebase actualizado correctamente!");
        } else {
            console.log("No se pudo extraer rawData de Temu.");
        }
    } catch (error) {
        console.error("Error en el proceso:", error);
    } finally {
        await browser.close();
    }
}

// AQUÍ PONES TU LINK Y EL ID DE TU PRODUCTO EN FIREBASE
actualizarPrecioTemu('LINK_DE_TEMU_AQUÍ', 'ID_DE_TU_DOC');