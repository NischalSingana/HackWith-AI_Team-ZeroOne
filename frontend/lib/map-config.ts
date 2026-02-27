import { Libraries } from "@react-google-maps/api";

// Shared libraries constant to prevent "Loader must not be called again with different options" error
// The libraries array must be the same reference across the entire app
export const GOOGLE_MAPS_LIBRARIES: Libraries = ["visualization"];
