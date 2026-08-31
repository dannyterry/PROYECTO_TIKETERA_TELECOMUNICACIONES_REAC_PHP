<?php

class HomeController extends Controller
{
    private $homeModel;

    public function __construct()
    {
        parent::__construct();
        $this->homeModel = $this->model('HomeModel');
    }

    // ========== Metodo index ==========
    public function index()
    {
        $this->view('home/index');
    }

    // ========== Metodo obtener ==========
    public function obtener($id)
    {
        $rows = $this->homeModel->getAll_($id);

        $data = [
            'rows' => $rows
        ];

        $this->view('home/index', $data);
    }
}
