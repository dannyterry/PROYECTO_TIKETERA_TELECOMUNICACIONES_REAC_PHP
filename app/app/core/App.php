<?php
class App {
    protected $controller = 'HomeController';
    protected $method = 'index';
    protected $params = [];
    protected $routes = [];

    public function __construct() {
        $this->routes = require_once 'app/config/routes.php';
        
        $url = $this->parseUrl();
        $routeKey = implode('/', $url);
        // $routeKey = strtolower(implode('/', $url));
        $foundRoute = false;

        // Buscar rutas estáticas
        if (isset($this->routes[$routeKey])) {
            $this->controller = $this->routes[$routeKey]['controller'];
            $this->method = $this->routes[$routeKey]['method'];
            $url = [];
            $foundRoute = true;
        } else {
            // Buscar rutas dinámicas
            foreach ($this->routes as $route => $routeData) {
                $pattern = preg_replace('/{[^\/]+}/', '([^\/]+)', $route);
                if (preg_match("#^$pattern$#i", $routeKey, $matches)) {
                    $this->controller = $routeData['controller'];
                    $this->method = $routeData['method'];
                    array_shift($matches); // Quitar el match completo
                    $this->params = $matches;
                    $foundRoute = true;
                    break;
                }
            }
        }

        // Si no se encuentra la ruta, redirigir al controlador de errores
        if (!$foundRoute) {
            $this->controller = 'ErrorController';
            $this->method = 'index';
        }

        require_once 'app/controllers/' . $this->controller . '.php';
        $this->controller = new $this->controller;

        call_user_func_array([$this->controller, $this->method], $this->params);
    }

    public function parseUrl() {
        if (isset($_SERVER['REQUEST_URI'])) {
            $projectPath = parse_url(BASE_URL, PHP_URL_PATH);
            
            $url = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
            
            if (!empty($projectPath)) {
                $url = str_replace(trim($projectPath, '/'), '', $url);
            }
    
            $url = trim($url, '/');
            if ($url) {
                return explode('/', filter_var($url, FILTER_SANITIZE_URL));
            }
        }
        return [];
    }
}

