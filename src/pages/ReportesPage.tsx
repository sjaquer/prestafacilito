import React from "react";
import { useNavigate } from "react-router-dom";
import { ReporteIA } from "../components/ReporteIA";

export const ReportesPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <ReporteIA onBack={() => navigate("/")} />
  );
};
