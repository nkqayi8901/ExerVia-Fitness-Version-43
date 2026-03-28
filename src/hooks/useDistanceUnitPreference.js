import { useEffect, useState } from "react";
import {
  getDistanceUnitPreference,
  normalizeDistanceUnit,
  setDistanceUnitPreference,
} from "../utils/athleteMetrics";

export default function useDistanceUnitPreference() {
  const [distanceUnit, setDistanceUnit] = useState(() => getDistanceUnitPreference());

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key && event.key !== "exervia_distance_unit") return;
      setDistanceUnit(getDistanceUnitPreference());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const updateDistanceUnit = (nextUnit) => {
    const normalized = normalizeDistanceUnit(nextUnit);
    setDistanceUnitPreference(normalized);
    setDistanceUnit(normalized);
  };

  return [distanceUnit, updateDistanceUnit];
}
