// Standardized UI exports wrapping HeroUI to enforce consistent variants
export {
  // basics
  Button,
  Tooltip,
  Switch,
  Input,
  Select,
  SelectItem,
  Autocomplete,
  AutocompleteItem,
  Spinner,
  // layout & surfaces
  Card,
  CardBody,
  CardHeader,
  Divider,
  Chip,
  // navigation
  Tabs,
  Tab,
  Navbar,
  NavbarBrand,
  NavbarContent,
  // menus
  Dropdown,
  DropdownMenu,
  DropdownTrigger,
  DropdownItem,
  // lists
  Listbox,
  ListboxItem,
  // misc
  Avatar,
  Kbd,
  // modal primitives
  Modal as HeroModal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react';

// Common props defaults can be centralized here later via wrapper components if needed.
// For now, re-exporting allows a single import surface across the app.
