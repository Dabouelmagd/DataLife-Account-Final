const parser = require(process.env.BABEL_PARSER_PATH || '/tmp/babelcheck/node_modules/@babel/parser');
const fs = require('fs'), path = require('path');
function files(dir){ return fs.readdirSync(dir).flatMap(f=>{const p=path.join(dir,f);
  return fs.statSync(p).isDirectory()&&f!=='node_modules'?files(p):(/\.jsx?$/.test(f)?[p]:[]); }); }
const problems = [];
for (const file of files(process.argv[2])) {
  let ast; try { ast = parser.parse(fs.readFileSync(file,'utf8'),{sourceType:'module',plugins:['jsx']}); }
  catch { continue; }
  const globals = new Set();
  for (const n of ast.program.body) {
    if (n.type==='ImportDeclaration') n.specifiers.forEach(s=>globals.add(s.local.name));
    if (n.type==='VariableDeclaration') n.declarations.forEach(d=>{
      if (d.id&&d.id.name) globals.add(d.id.name);
      if (d.id&&d.id.type==='ArrayPattern') d.id.elements.forEach(e=>e&&e.name&&globals.add(e.name));
      if (d.id&&d.id.type==='ObjectPattern') d.id.properties.forEach(pr=>pr.value&&pr.value.name&&globals.add(pr.value.name));
    });
    if (n.type==='FunctionDeclaration'&&n.id) globals.add(n.id.name);
  }
  function bind(node, scope){
    if (!node) return;
    if (node.name) scope.add(node.name);
    else if (node.type==='ArrayPattern') node.elements.forEach(e=>bind(e, scope));
    else if (node.type==='ObjectPattern') node.properties.forEach(pr=>bind(pr.value||pr.argument, scope));
    else if (node.type==='RestElement'||node.type==='AssignmentPattern') bind(node.argument||node.left, scope);
  }

  (function walk(n, scopes){
    if(!n||typeof n!=='object') return;
    const opens = /Function|ArrowFunctionExpression/.test(n.type) || n.type==='BlockStatement' || n.type==='Program';
    if (opens) scopes = [...scopes, new Set()];
    // names bound by destructuring count as declared:
    // const [a, setA] = useState(), const { x } = props
    if (n.type==='VariableDeclarator'&&n.id) bind(n.id, scopes[scopes.length-1]);
    if (n.params) n.params.forEach(p=>bind(p, scopes[scopes.length-1]));
    // a local-looking map read from another component's scope is the bug we hunt
    if (n.type==='MemberExpression'&&n.object&&n.object.type==='Identifier'
        && /Map$|Config$|Options$/.test(n.object.name)
        && !globals.has(n.object.name) && !scopes.some(s=>s.has(n.object.name)))
      problems.push(`${path.relative(process.cwd(),file)}:${n.loc.start.line}: "${n.object.name}" is not in scope here`);
    for (const k in n){ const v=n[k];
      if (Array.isArray(v)) v.forEach(c=>walk(c,scopes));
      else if (v&&typeof v==='object'&&v.type) walk(v,scopes); }
  })(ast,[new Set()]);
}
console.log(problems.length ? 'SCOPE_ERRORS:'+problems.join('|') : 'SCOPE_OK');
