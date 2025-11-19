"use client";

import { Search } from "lucide-react";
import { motion } from "framer-motion";

type SearchBarProps = {
  onSearch: (value: string) => void;
  placeholder?: string;
};

const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  placeholder = "Search...",
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative"
    >
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
      <input
        type="text"
        onChange={(e) => onSearch(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-12 pr-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors shadow-sm"
      />
    </motion.div>
  );
};

export default SearchBar;
