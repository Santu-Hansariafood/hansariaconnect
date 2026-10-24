"use client";

import { Search } from "lucide-react";

type SearchBarProps = {
  onSearch: (value: string) => void;
  placeholder?: string;
  accentColor?: string;
};

const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  placeholder = "Search...",
  accentColor = "#00a884",
}) => {
  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#54656f]" />
      <input
        type="text"
        onChange={(e) => onSearch(e.target.value)}
        placeholder={placeholder}
        style={{ caretColor: accentColor }}
        className="w-full rounded-lg border border-transparent bg-[#f0f2f5] py-2.5 pl-11 pr-4 text-base text-[#111b21] outline-none transition-all duration-150 placeholder:text-[#54656f] focus:bg-white sm:py-2 sm:text-[14px]"
        onFocus={(e) => {
          e.currentTarget.style.boxShadow = `0 0 0 1px ${accentColor}33`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = "";
        }}
      />
    </div>
  );
};

export default SearchBar;
