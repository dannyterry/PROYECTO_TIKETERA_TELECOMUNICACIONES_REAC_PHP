<?php

class Model
{
    protected $db;

    public function __construct()
    {
        $this->db = Database::getInstance()->getConnection();
    }

    // Método para ejecutar consultas SQL
    public function query($sql, $params = [])
    {
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    // Método para obtener todos los resultados de una consulta
    public function getAll($sql, $params = [])
    {
        $stmt = $this->query($sql, $params);
        return $stmt->fetchAll(PDO::FETCH_OBJ);
    }

    // Método para obtener un solo resultado de una consulta
    public function getOne($sql, $params = [])
    {
        $stmt = $this->query($sql, $params);
        return $stmt->fetch(PDO::FETCH_OBJ);
    }

    // Método para obtener el último ID insertado
    public function lastInsertId()
    {
        return $this->db->lastInsertId();
    }

    // Método para esperar transaccion
    public function beginTransaction()
    {
        return $this->db->beginTransaction();
    }

    // Método para confirmar transaccion
    public function commit()
    {
        return $this->db->commit();
    }

    // Método para revertir transaccion
    public function rollBack()
    {
        return $this->db->rollBack();
    }
}
