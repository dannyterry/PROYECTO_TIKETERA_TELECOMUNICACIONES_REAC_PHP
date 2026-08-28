const fs = require('fs');

const loginCtrlPath = 'C:\\xampp\\htdocs\\corporacionescepe\\app\\controllers\\LoginController.php';
const loginModelPath = 'C:\\xampp\\htdocs\\corporacionescepe\\app\\models\\LoginModel.php';

let ctrlCode = fs.readFileSync(loginCtrlPath, 'utf8');
if (!ctrlCode.includes('marcarOnline_')) {
  ctrlCode = ctrlCode.replace(
    "\$_SESSION['login'] = true;",
    "\$_SESSION['login'] = true;\n            \$this->loginModel->marcarOnline_(\$user->id_usuario);"
  );
  ctrlCode = ctrlCode.replace(
    "public function salir()",
    `public function salir()
    {
        if (!empty($_SESSION['auth']['id_usuario'])) {
            $this->loginModel->marcarOffline_($_SESSION['auth']['id_usuario']);
        }
        session_destroy();
        header("Location: " . base_url());
        exit();
    }
    private function _dummySalir()`
  );
  fs.writeFileSync(loginCtrlPath, ctrlCode, 'utf8');
  console.log('✅ LoginController.php updated with marcarOnline_ on login and marcarOffline_ on logout.');
}

let modelCode = fs.readFileSync(loginModelPath, 'utf8');
if (!modelCode.includes('marcarOnline_')) {
  const helperMethods = `
    public function marcarOnline_($id_usuario)
    {
        try {
            $sql = "UPDATE {$this->table} SET ultimo_acceso = NOW(), esta_online = 1 WHERE {$this->id} = :id";
            $this->query($sql, [':id' => $id_usuario]);
        } catch (Exception $e) {}
    }

    public function marcarOffline_($id_usuario)
    {
        try {
            $sql = "UPDATE {$this->table} SET esta_online = 0 WHERE {$this->id} = :id";
            $this->query($sql, [':id' => $id_usuario]);
        } catch (Exception $e) {}
    }
`;
  modelCode = modelCode.replace(
    "public function validar_",
    helperMethods + "\n    public function validar_"
  );
  fs.writeFileSync(loginModelPath, modelCode, 'utf8');
  console.log('✅ LoginModel.php updated with marcarOnline_ and marcarOffline_ methods.');
}
