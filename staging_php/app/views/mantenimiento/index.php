<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Módulo en Mantenimiento</title>

    <style>
        #maintenance-page * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        #maintenance-page {
            /* min-height: 100vh; */
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: 'Segoe UI', sans-serif;
        }

        #maintenance-page .maintenance-wrapper {
            background: linear-gradient(135deg, #4e73df, #1cc88a);
            padding: 50px 40px;
            border-radius: 20px;
            text-align: center;
            color: #fff;
            width: 90%;
            max-width: 500px;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
            animation: fadeIn 0.8s ease-in-out;
        }

        #maintenance-page .icon {
            font-size: 70px;
            margin-bottom: 20px;
            animation: float 3s ease-in-out infinite;
        }

        #maintenance-page h1 {
            font-size: 28px;
            margin-bottom: 15px;
            font-weight: 700;
        }

        #maintenance-page p {
            font-size: 16px;
            opacity: 0.9;
            margin-bottom: 30px;
            line-height: 1.6;
        }

        #maintenance-page .buttons {
            display: flex;
            justify-content: center;
            gap: 15px;
        }

        #maintenance-page .buttons a {
            padding: 10px 25px;
            border-radius: 50px;
            text-decoration: none;
            font-weight: 500;
            transition: 0.3s ease;
        }

        #maintenance-page .btn-back {
            background: transparent;
            border: 2px solid #fff;
            color: #fff;
        }

        #maintenance-page .btn-home {
            background: #fff;
            color: #333;
        }

        #maintenance-page .buttons a:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
        }

        #maintenance-page .footer {
            margin-top: 25px;
            font-size: 14px;
            opacity: 0.8;
            color: #fff;
        }

        /* Animaciones */
        @keyframes float {
            0% {
                transform: translateY(0px);
            }

            50% {
                transform: translateY(-10px);
            }

            100% {
                transform: translateY(0px);
            }
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: scale(0.9);
            }

            to {
                opacity: 1;
                transform: scale(1);
            }
        }
    </style>
</head>

<body>

    <div id="maintenance-page">
        <div class="maintenance-wrapper">

            <div class="icon">🛠️</div>

            <h1>Estamos en Mantenimiento</h1>

            <p>
                Este módulo se encuentra en proceso de actualización.
                Muy pronto estará disponible con mejoras y nuevas funcionalidades.
            </p>

            <div class="buttons">
                <a href="<?= base_url() ?>dashboard" class="btn-back">Volver</a>
                <a href="<?= base_url() ?>dashboard" class="btn-home">Inicio</a>
            </div>


        </div>
    </div>

</body>

</html>