import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
 CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type LoginProps = {
  onLogin: () => void;
};

export default function Login({ onLogin }: LoginProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Portal RRHH</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <Input
            type="email"
            placeholder="Correo"
          />

          <Input
            type="password"
            placeholder="Contraseña"
          />

         <Button
         className="w-full"
         onClick={onLogin}
>
          Ingresar
         </Button>
        </CardContent>
      </Card>
    </div>
  );
}