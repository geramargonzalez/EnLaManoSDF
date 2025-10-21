/**
 * Test de llamada a MYM API
 */

const https = require('https');

const documento = process.argv[2] || '53350991';

console.log('Probando MYM API con documento:', documento);

const MYM_CONFIG = {
    hostname: 'riskapi.info',
    path: '/api/models/v2/enlamanocrm/execute',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from('prod2_enlamano:dfer4edr').toString('base64')
    }
};

function callMymApi(periodo) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            inputs: [{ 
                documento: documento, 
                tipoDocumento: 'CI',
                periodo: periodo 
            }]
        });

        console.log(`\nLlamando a MYM (${periodo})...`);
        console.log('Body:', body);

        const req = https.request(MYM_CONFIG, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    console.log(`\n✅ Respuesta ${periodo}:`);
                    console.log(JSON.stringify(parsed, null, 2).substring(0, 500));
                    resolve(parsed);
                } catch (e) {
                    console.error('Error parsing JSON:', e.message);
                    console.log('Raw data:', data.substring(0, 200));
                    reject(e);
                }
            });
        });

        req.on('error', (e) => {
            console.error('Request error:', e.message);
            reject(e);
        });
        
        req.write(body);
        req.end();
    });
}

async function main() {
    try {
        const [respT2, respT6] = await Promise.all([
            callMymApi('t2'),
            callMymApi('t6')
        ]);

        console.log('\n═══════════════════════════════════════════════');
        console.log('ESTRUCTURA DE RESPUESTAS');
        console.log('═══════════════════════════════════════════════');
        
        console.log('\nT2 keys:', Object.keys(respT2));
        console.log('T6 keys:', Object.keys(respT6));
        
        if (respT2.outputs) {
            console.log('\nT2.outputs length:', respT2.outputs.length);
            if (respT2.outputs[0]) {
                console.log('T2.outputs[0] keys:', Object.keys(respT2.outputs[0]));
                if (respT2.outputs[0].data) {
                    console.log('T2.outputs[0].data keys:', Object.keys(respT2.outputs[0].data));
                }
            }
        }

    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }
}

main();
