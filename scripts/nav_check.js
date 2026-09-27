// Every onNavigate('x') must name a module the renderer can actually render.
// A dead link shows "هذه الصفحة غير متاحة" with an internal id — which reads
// as a broken product. This resolves each target against ModuleRenderer.
const parser = require(process.env.BABEL_PARSER_PATH || '/tmp/babelcheck/node_modules/@babel/parser');
const fs = require('fs'), path = require('path');
const root = process.argv[2];
function files(dir){ return fs.readdirSync(dir).flatMap(f=>{const p=path.join(dir,f);
  return fs.statSync(p).isDirectory()&&f!=='node_modules'?files(p):(/\.jsx?$/.test(f)?[p]:[]); }); }

const rendererPath = path.join(root, 'components', 'ModuleRenderer.jsx');
if (!fs.existsSync(rendererPath)) { console.log('NAV_OK'); process.exit(0); }
const rAst = parser.parse(fs.readFileSync(rendererPath,'utf8'),{sourceType:'module',plugins:['jsx']});
const known = new Set();
JSON.stringify(rAst,(k,v)=>{
  if(v&&v.type==='ObjectProperty'&&v.key&&(v.key.value||v.key.name)) known.add(v.key.value||v.key.name);
  if(v&&v.type==='BinaryExpression'&&v.left&&v.left.name==='activeModule'&&v.right&&v.right.value) known.add(v.right.value);
  return v; });
known.add('dashboard');

const problems = [];
for (const file of files(root)) {
  let ast; try { ast = parser.parse(fs.readFileSync(file,'utf8'),{sourceType:'module',plugins:['jsx']}); } catch { continue; }
  JSON.stringify(ast,(k,v)=>{
    // onNavigate?.('x') parses as OptionalCallExpression, not CallExpression —
    // missing that made the checker pass a link it was written to catch
    if (v&&(v.type==='CallExpression'||v.type==='OptionalCallExpression')) {
      const callee = v.callee;
      const name = callee && (callee.property?.name || callee.name)
        || (callee?.type==='OptionalMemberExpression' && callee.property?.name);
      if (name === 'onNavigate' || name === 'setActiveModule') {
        const a = v.arguments && v.arguments[0];
        if (a && a.type === 'StringLiteral' && !known.has(a.value) && !a.value.startsWith('pack_'))
          problems.push(`${path.relative(process.cwd(),file)}:${v.loc.start.line}: navigates to "${a.value}", which no screen handles`);
      }
    }
    return v; });
}
console.log(problems.length ? 'NAV_ERRORS:'+[...new Set(problems)].join('|') : 'NAV_OK');
