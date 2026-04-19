const puppeteer = require('puppeteer');
const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function actualizarPrecioTemu(urlProducto, idEnTuWeb) {
    console.log(`Buscando precio para: ${idEnTuWeb}`);
    const browser = await puppeteer.launch({ 
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        await page.goto(urlProducto, { waitUntil: 'networkidle2' });
        const rawData = await page.evaluate(() => window.rawData);

        if (rawData) {
            const precioStr = rawData.store.priceModule.data.goodsSalePriceRich.ariaLabel;
            const precioLimpio = parseFloat(precioStr.replace(/[^\d.]/g, ''));
            console.log(`Precio encontrado: S/ ${precioLimpio}`);

            await db.collection('productos').doc(idEnTuWeb).set({
                precioTemu: precioLimpio,
                ultimaActualizacion: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log("¡Firebase actualizado!");
        }
    } catch (e) { console.error(e); } finally { await browser.close(); }
}

actualizarPrecioTemu('https://www.temu.com/pe/g-601105668136049.html', 'tapones_pro_3');
