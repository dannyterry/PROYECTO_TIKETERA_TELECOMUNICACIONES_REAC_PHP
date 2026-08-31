<?php

class ErrorController extends Controller
{

    public function __construct()
    {
        parent::__construct();
    }

    // ========== Metodo index ==========
    public function index()
    {
        $data = [
            'titulo' => "Error",
            'js' => "dashboard",
            'modal' => false,
        ];

        $this->view('error/index', $data);
    }
}
