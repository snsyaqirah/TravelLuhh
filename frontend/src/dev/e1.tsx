/* eslint-disable react-refresh/only-export-components -- entry file for a dev-only page */
// Dev-only harness for the E1 foundations: type scale, tokens, and every restyled shadcn primitive.
// Open http://localhost:<port>/dev/e1.html. `?open=dialog|alert|sheet|drawer|menu|select|popover|toast|command`
// renders that overlay open so it can be screenshotted.
import * as React from "react";
import { createRoot } from "react-dom/client";
import { CalendarDays, MoreHorizontal, Plus, Search, Trash2 } from "lucide-react";
import { toast as sonnerToast } from "sonner";

import "@/index.css";
import { AppThemeProvider, ThemeToggle, useThemeName } from "@/components/theme/ThemeProvider";
import { BalangMark, Wordmark } from "@/components/brand/Wordmark";
import { CATEGORY_CSS_KEY, CATEGORY_ORDER, categoryColors, sidebar, tokens } from "@/design/tokens";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toaster as RadixToaster } from "@/components/ui/toaster";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

const OPEN = new URLSearchParams(window.location.search).get("open");

const CATEGORY_LABEL: Record<string, [string, string]> = {
  accommodation: ["Stay", "STY"],
  transportation: ["Transport", "TRN"],
  activities: ["Activities", "ACT"],
  bundle: ["Packages", "PKG"],
  food: ["Food", "FNB"],
  shopping: ["Shopping", "SHP"],
  other: ["Other", "MSC"],
};

function Section({ code, title, children }: { code: string; title: string; children: React.ReactNode }) {
  return (
    <section data-e1-section className="border-t border-rule pt-6">
      <p className="type-overline text-ink-3">{code}</p>
      <h2 className="type-display-3 mb-5 mt-1 text-ink">{title}</h2>
      {children}
    </section>
  );
}

function TypeScale() {
  return (
    <div className="space-y-5">
      <p className="type-display-1 text-ink">
        Every trip starts as a <em>tabung</em>.
      </p>
      <p className="type-display-2 text-ink">
        Where did all the <em>ringgit</em> go?
      </p>
      <p className="type-display-3 text-ink">Tokyo autumn</p>
      <p className="type-money-hero text-ink">
        <span className="mr-1 align-[0.95em] font-mono text-[0.32em] font-medium text-ink-3">RM</span>2,340
        <span className="text-[0.6em]">.50</span>
      </p>
      <p className="type-money-l text-fund">RM 312.00</p>
      <p className="type-title text-ink">≈ RM 312 a day for the next 6 days.</p>
      <p className="type-body max-w-prose text-ink">
        Set a target, then spend through it on the road. Every ringgit accounted for, in whatever currency you're
        paying in.
      </p>
      <p className="type-body-s text-ink-2">Rates from 14 Oct, 4:10 pm. Live rates aren't loading right now.</p>
      <p className="type-label text-ink">Trip name</p>
      <p className="type-ledger text-ink">14 NOV · FNB · Ramen Ichiran · ¥ 3,200 · RM 96.40</p>
      <p className="type-overline text-ink-3">MY → JP · 12–20 NOV · 9D8N</p>
      <p className="type-stamp inline-block rotate-[-4deg] border-2 border-stamp px-2 py-1 text-stamp">Balik</p>
    </div>
  );
}

function Swatches() {
  const theme = useThemeName();
  const t = tokens[theme];
  const names = Object.keys(t) as (keyof typeof t)[];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {names.map((name) => (
          <div key={name} className="flex items-center gap-2">
            <span className="h-9 w-9 shrink-0 rounded-sm border border-rule" style={{ background: t[name] }} />
            <span className="min-w-0">
              <span className="type-label block truncate text-ink">{name}</span>
              <span className="type-ledger block text-[12px] text-ink-3">{t[name]}</span>
            </span>
          </div>
        ))}
      </div>
      <div>
        <p className="type-overline mb-2 text-ink-3">Categories, fixed order</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {CATEGORY_ORDER.map((key) => (
            <div key={key} className="rounded-sm border border-rule bg-card p-2">
              <span className={`block h-6 rounded-sm bg-cat-${CATEGORY_CSS_KEY[key]}`} />
              <span className="type-overline mt-1.5 block text-ink">{CATEGORY_LABEL[key][1]}</span>
              <span className="type-body-s block text-ink-2">{CATEGORY_LABEL[key][0]}</span>
              <span className="type-ledger block text-[11px] text-ink-3">{categoryColors[theme][key]}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4 rounded-lg p-4" style={{ background: sidebar[theme].background }}>
        <Wordmark tone="sidebar" />
        <ThemeToggle tone="sidebar" size="sm" className="ml-auto" />
      </div>
      <div className="flex flex-wrap items-center gap-4 rounded-lg bg-fund p-4">
        <Wordmark tone="onFund" size="sm" />
        <span className="type-body-s text-on-fund">Primary fill, on-fund text</span>
      </div>
    </div>
  );
}

function Buttons() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Button>
          <Plus /> Start a tabung
        </Button>
        <Button variant="secondary">I already have one</Button>
        <Button variant="ghost">Skip for now</Button>
        <Button variant="link">See the ledger</Button>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button variant="destructive">
          <Trash2 /> Delete trip
        </Button>
        <Button variant="warning">Top up the jar</Button>
        <Button variant="outline">Outline (secondary)</Button>
        <Button disabled>Masuk</Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
        <Button size="icon" variant="ghost" aria-label="More">
          <MoreHorizontal />
        </Button>
        <Button size="icon" variant="secondary" aria-label="Pick dates">
          <CalendarDays />
        </Button>
      </div>
    </div>
  );
}

function Fields() {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="e1-name">Trip name</Label>
        <Input id="e1-name" placeholder="Tokyo autumn" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="e1-amount">Amount</Label>
        <Input id="e1-amount" inputMode="decimal" defaultValue="3,200" className="font-mono" />
      </div>
      <div className="space-y-2">
        <Label>Category</Label>
        <Select defaultValue="food" defaultOpen={OPEN === "select"}>
          <SelectTrigger>
            <SelectValue placeholder="Pick a category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_ORDER.map((key) => (
              <SelectItem key={key} value={key}>
                {CATEGORY_LABEL[key][0]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="e1-budget">Budget</Label>
        <Input id="e1-budget" aria-invalid defaultValue="-40" />
        <p className="type-body-s text-stamp">Budget can't be negative.</p>
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="e1-notes">Notes</Label>
        <Textarea id="e1-notes" placeholder="Saved on this device only" />
      </div>
    </div>
  );
}

function Controls() {
  const [packed, setPacked] = React.useState(true);
  const [split, setSplit] = React.useState([60]);
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Checkbox id="e1-c1" checked={packed} onCheckedChange={(v) => setPacked(v === true)} />
          <Label htmlFor="e1-c1">Passport</Label>
        </div>
        <div className="flex items-center gap-3">
          <Checkbox id="e1-c2" />
          <Label htmlFor="e1-c2">Power bank</Label>
        </div>
        <div className="flex items-center gap-3">
          <Checkbox id="e1-c3" disabled />
          <Label htmlFor="e1-c3">Umbrella (disabled)</Label>
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Switch id="e1-s1" defaultChecked />
          <Label htmlFor="e1-s1">3D scenes</Label>
        </div>
        <div className="flex items-center gap-3">
          <Switch id="e1-s2" />
          <Label htmlFor="e1-s2">Budget alerts</Label>
        </div>
      </div>
      <RadioGroup defaultValue="shared" aria-label="Budget type">
        <div className="flex items-center gap-3">
          <RadioGroupItem value="solo" id="e1-r1" />
          <Label htmlFor="e1-r1">Solo</Label>
        </div>
        <div className="flex items-center gap-3">
          <RadioGroupItem value="shared" id="e1-r2" />
          <Label htmlFor="e1-r2">Shared with the geng</Label>
        </div>
      </RadioGroup>
      <div className="space-y-4">
        <div>
          <p className="type-label mb-1 text-ink">Aiman pays {split[0]}%</p>
          <Slider value={split} onValueChange={setSplit} max={100} step={5} aria-label="Aiman's share" />
        </div>
        <div>
          <p className="type-label mb-2 text-ink">Packed 7 of 12</p>
          <Progress value={58} aria-label="Packed" />
        </div>
      </div>
      <ToggleGroup type="single" defaultValue="all" aria-label="Filter trips" className="sm:col-span-2">
        <ToggleGroupItem value="all">All</ToggleGroupItem>
        <ToggleGroupItem value="upcoming">Upcoming</ToggleGroupItem>
        <ToggleGroupItem value="road">On the road</ToggleGroupItem>
        <ToggleGroupItem value="home">Home</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

function LedgerTabsDemo() {
  const tabs = [
    ["fund", "Fund", null],
    ["ledger", "Ledger", 38],
    ["days", "Days", 9],
    ["pack", "Pack", 12],
    ["notes", "Notes", null],
  ] as const;
  return (
    <Tabs defaultValue="ledger">
      <TabsList>
        {tabs.map(([key, label, count]) => (
          <TabsTrigger key={key} value={key}>
            {label}
            {count !== null && <span className="font-mono text-xs text-ink-3">{count}</span>}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="ledger">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Details</TableHead>
              <TableHead className="text-right">Out</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="type-ledger">
            {[
              ["14 NOV", "Ramen Ichiran", "RM 96.40"],
              ["14 NOV", "Suica top-up", "RM 61.00"],
              ["15 NOV", "teamLab Planets", "RM 118.20"],
            ].map(([d, what, amt]) => (
              <TableRow key={what}>
                <TableCell className="text-ink-2">{d}</TableCell>
                <TableCell className="font-sans">{what}</TableCell>
                <TableCell className="text-right">{amt}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2}>Day total</TableCell>
              <TableCell className="text-right">RM 275.60</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </TabsContent>
      <TabsContent value="fund">
        <p className="type-body text-ink-2">RM 2,340 of RM 4,000 left · Day 3 of 9</p>
      </TabsContent>
      <TabsContent value="days">
        <p className="type-body text-ink-2">Free day. Makan, jalan, or sleep in.</p>
      </TabsContent>
      <TabsContent value="pack">
        <p className="type-body text-ink-2">Empty bag. Start from a list or add your own.</p>
      </TabsContent>
      <TabsContent value="notes">
        <p className="type-body text-ink-2">Saved on this device only</p>
      </TabsContent>
    </Tabs>
  );
}

function Overlays() {
  const { toast } = useToast();
  const [commandOpen, setCommandOpen] = React.useState(OPEN === "command");

  React.useEffect(() => {
    if (OPEN !== "toast") return;
    // Wait a tick so both toasters have mounted and subscribed.
    const id = window.setTimeout(() => {
      sonnerToast("Masuk. ¥ 3,200 to Food.", { action: { label: "Undo", onClick: () => undefined } });
      sonnerToast.error("Alamak, can't reach the server.", {
        description: "Your entries are safe. Try again in a moment.",
      });
      toast({ title: "Tabung opened", description: "Jom! Day 1 is 28 days away." });
    }, 300);
    return () => window.clearTimeout(id);
  }, [toast]);

  return (
    <div className="flex flex-wrap gap-3">
      <Dialog defaultOpen={OPEN === "dialog"}>
        <DialogTrigger asChild>
          <Button variant="secondary">Edit trip</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tokyo autumn</DialogTitle>
            <DialogDescription>Dates and budget. Entries stay where they are.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="e1-d-budget">Budget</Label>
            <Input id="e1-d-budget" defaultValue="4,000.00" className="font-mono" />
          </div>
          <DialogFooter>
            <Button variant="secondary">Cancel</Button>
            <Button>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog defaultOpen={OPEN === "alert"}>
        <AlertDialogTrigger asChild>
          <Button variant="destructive">Delete trip</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tokyo autumn?</AlertDialogTitle>
            <AlertDialogDescription>This removes the trip and all 38 entries for good.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction variant="destructiveSolid">Delete trip</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet defaultOpen={OPEN === "sheet"}>
        <SheetTrigger asChild>
          <Button>
            <Plus /> Log spend
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Log spend</SheetTitle>
            <SheetDescription>Day 3 · Wed 14 Nov · ≈ RM 312 left today</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            <Label htmlFor="e1-s-amt">Amount</Label>
            <Input id="e1-s-amt" defaultValue="¥ 3,200" className="font-mono" />
          </div>
          <SheetFooter className="mt-5">
            <Button className="w-full sm:w-auto">Masuk</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Drawer defaultOpen={OPEN === "drawer"} shouldScaleBackground={false}>
        <DrawerTrigger asChild>
          <Button variant="secondary">Kongsi</Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Kongsi</DrawerTitle>
            <DrawerDescription>Aiman → Siti · RM 82.50</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <Button>Copy for WhatsApp</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <DropdownMenu defaultOpen={OPEN === "menu"}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Trip menu">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Tokyo autumn</DropdownMenuLabel>
          <DropdownMenuItem>
            Edit <DropdownMenuShortcut>E</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>Logbook</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-stamp focus:text-stamp">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Popover defaultOpen={OPEN === "popover"}>
        <PopoverTrigger asChild>
          <Button variant="secondary">
            <CalendarDays /> 12–20 Nov
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={new Date(2026, 10, 1)}
            selected={{ from: new Date(2026, 10, 12), to: new Date(2026, 10, 20) }}
          />
        </PopoverContent>
      </Popover>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost">Rates</Button>
        </TooltipTrigger>
        <TooltipContent>Rates from 15 Oct</TooltipContent>
      </Tooltip>

      <Button variant="secondary" onClick={() => setCommandOpen(true)}>
        <Search /> Find a trip
      </Button>
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Tokyo, Bali, Hat Yai..." />
        <CommandList>
          <CommandEmpty>No trips by that name.</CommandEmpty>
          <CommandGroup heading="Trips">
            <CommandItem>
              Tokyo autumn <CommandShortcut>JP</CommandShortcut>
            </CommandItem>
            <CommandItem>
              Bali with the geng <CommandShortcut>ID</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <Button
        variant="secondary"
        onClick={() =>
          sonnerToast("Masuk. ¥ 3,200 to Food.", { action: { label: "Undo", onClick: () => undefined } })
        }
      >
        Toast
      </Button>
      <Button
        variant="secondary"
        onClick={() => toast({ variant: "destructive", title: "Couldn't save", description: "Alamak, can't reach the server." })}
      >
        Radix toast
      </Button>
    </div>
  );
}

function Misc() {
  const [otp, setOtp] = React.useState("4821");
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Tokyo autumn</CardTitle>
          <CardDescription>MY → JP · 12–20 Nov · 9D8N</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge>Upcoming</Badge>
            <Badge variant="secondary">Solo</Badge>
            <Badge variant="destructive">Over</Badge>
            <Badge variant="outline">JP</Badge>
            <Badge variant="outline">MY</Badge>
            <Badge variant="warning">Day 3/9</Badge>
            <Badge variant="solid">Siap</Badge>
          </div>
          <Alert>
            <AlertTitle>RM 210 left for 2 days.</AlertTitle>
            <AlertDescription>Still okay if you slow down a bit.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>Over by RM 240.</AlertTitle>
            <AlertDescription>Happens. Here's where it went.</AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="justify-between">
          <span className="type-ledger text-ink-2">Baki</span>
          <span className="type-money-l text-ink">RM 1,659.80</span>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Loading state</CardTitle>
          <CardDescription>Static ruled blocks, no shimmer.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-24 w-full" />
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>SO</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>AI</AvatarFallback>
            </Avatar>
            <Skeleton className="h-4 flex-1" />
          </div>
          <Separator />
          <div className="space-y-2">
            <p className="type-label text-ink">We sent a 6-digit code to s•••@gmail.com.</p>
            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-rule bg-card p-2">
        <Calendar mode="single" defaultMonth={new Date(2026, 10, 1)} selected={new Date(2026, 10, 14)} />
      </div>

      <Accordion type="single" collapsible defaultValue="a">
        <AccordionItem value="a">
          <AccordionTrigger>Where's the money kept?</AccordionTrigger>
          <AccordionContent>
            Phase A treats the budget as already set aside. The jar starts full and drains as you log spend.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="b">
          <AccordionTrigger>What does 9D8N mean?</AccordionTrigger>
          <AccordionContent>Nine days, eight nights.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="c">
          <AccordionTrigger>Rates and currencies</AccordionTrigger>
          <AccordionContent>No rate for VND today, so totals are shown per currency.</AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function Harness() {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="mx-auto max-w-[1120px] space-y-10 px-4 py-6 lg:px-6 lg:py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Wordmark size="lg" />
            <BalangMark size={40} title="Balang mark, 40px" />
          </div>
          <ThemeToggle />
        </header>
        <Section code="01 · §4" title="Type">
          <TypeScale />
        </Section>
        <Section code="02 · §3" title="Colour">
          <Swatches />
        </Section>
        <Section code="03 · §5.3" title="Buttons">
          <Buttons />
        </Section>
        <Section code="04 · §5.2" title="Fields">
          <Fields />
        </Section>
        <Section code="05 · §5.3" title="Controls">
          <Controls />
        </Section>
        <Section code="06 · §5.4" title="Ledger tabs and table">
          <LedgerTabsDemo />
        </Section>
        <Section code="07 · §5.2" title="Sheets, dialogs, menus, toasts">
          <Overlays />
        </Section>
        <Section code="08" title="Cards, chips, calendar">
          <Misc />
        </Section>
      </div>
      <SonnerToaster />
      <RadixToaster />
    </TooltipProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <AppThemeProvider>
    <Harness />
  </AppThemeProvider>,
);
