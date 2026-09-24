node -e "
const mysql = require('mysql2/promise');
const url = process.env.MARIADB_URL || 'mysql://mariadb:BXjbq9w2mwTel6ANoMTwH975nJS2q6n6yVQgHrm6NKTFRm5wdRf3VtROrbikOWTa@w3uymvdjpzxod6zqajtdkoom:3306/default';
mysql.createPool({uri:url,connectionLimit:2}).execute('SELECT 1 as ok').then(r=>console.log('DB OK', r[0])).catch(e=>console.error('DB ERR', e.code, e.message));
"
