import fs from 'fs';
import path from 'path';

function getEndpoints(dir) {
    let files = fs.readdirSync(dir);
    let res = [];
    for(let f of files) {
        let fullPath = path.join(dir, f);
        if(fs.statSync(fullPath).isDirectory()) {
            res = res.concat(getEndpoints(fullPath));
        } else if(fullPath.endsWith('.ts')) {
            let code = fs.readFileSync(fullPath, 'utf-8');
            let r = /app\.(get|post|put|delete|patch)\(\s*['"]([^'"]+)['"]/g;
            let m;
            while((m = r.exec(code)) !== null) {
                res.push(m[1].toUpperCase() + ' ' + m[2]);
            }
        }
    }
    return res;
}
let ep = getEndpoints('server');
fs.writeFileSync('endpoints3.txt', ep.join('\n'));
console.log('Found ' + ep.length + ' endpoints');
