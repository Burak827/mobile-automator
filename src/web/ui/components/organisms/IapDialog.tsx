import { useEffect, useMemo, useState } from "react";
import { useDialogController } from "../../hooks/useDialogController.js";
import Button from "../atoms/Button.js";
import SourceLocaleSelect from "../atoms/SourceLocaleSelect.js";
import type {
  AppStoreIapDetail,
  PlayStoreIapDetail,
  StoreIapEntry,
  StoreId,
} from "../../types.js";

type Props = {
  isOpen: boolean;
  selectedStore: StoreId;
  isLoading: boolean;
  isGenerating: boolean;
  sourceLocale: string;
  canShowIos: boolean;
  canShowPlay: boolean;
  appStoreIaps: StoreIapEntry[];
  playStoreIaps: StoreIapEntry[];
  onSelectStore: (store: StoreId) => void;
  onGenerate: (store: StoreId) => void;
  onClose: () => void;
};

function asAppStoreIapDetail(detail: unknown): AppStoreIapDetail | null {
  if (!detail || typeof detail !== "object") return null;
  const row = detail as Partial<AppStoreIapDetail>;
  if (typeof row.productId !== "string") return null;
  return row as AppStoreIapDetail;
}

function asPlayStoreIapDetail(detail: unknown): PlayStoreIapDetail | null {
  if (!detail || typeof detail !== "object") return null;
  const row = detail as Partial<PlayStoreIapDetail>;
  if (typeof row.productId !== "string") return null;
  return row as PlayStoreIapDetail;
}

function toSortedUnique(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0))).sort((a, b) =>
    a.localeCompare(b)
  );
}

function toDraftKey(store: StoreId, productId: string, locale: string, field: string): string {
  return `${store}::${productId}::${locale}::${field}`;
}

function hasOwn(source: Record<string, string>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(source, key);
}

export default function IapDialog({
  isOpen,
  selectedStore,
  isLoading,
  isGenerating,
  sourceLocale,
  canShowIos,
  canShowPlay,
  appStoreIaps,
  playStoreIaps,
  onSelectStore,
  onGenerate,
  onClose,
}: Props) {
  const dialogRef = useDialogController(isOpen, onClose);
  const [selectedProductByStore, setSelectedProductByStore] = useState<Record<StoreId, string>>({
    app_store: "",
    play_store: "",
  });
  const [selectedLocaleByStore, setSelectedLocaleByStore] = useState<Record<StoreId, string>>({
    app_store: "",
    play_store: "",
  });
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});

  const items = useMemo(
    () => (selectedStore === "app_store" ? appStoreIaps : playStoreIaps),
    [appStoreIaps, playStoreIaps, selectedStore]
  );
  const selectedProductId = selectedProductByStore[selectedStore];
  const selectedItem = useMemo(() => {
    if (items.length === 0) return null;
    return items.find((item) => item.productId === selectedProductId) ?? items[0];
  }, [items, selectedProductId]);
  const selectedItemProductId = selectedItem?.productId ?? "";
  const appStoreDetail = useMemo(
    () => (selectedStore === "app_store" ? asAppStoreIapDetail(selectedItem?.detail) : null),
    [selectedItem?.detail, selectedStore]
  );
  const playStoreDetail = useMemo(
    () => (selectedStore === "play_store" ? asPlayStoreIapDetail(selectedItem?.detail) : null),
    [selectedItem?.detail, selectedStore]
  );
  const localeOptions = useMemo(() => {
    if (selectedStore === "app_store") {
      const locales = appStoreDetail?.localizations?.map((entry) => entry.locale) ?? [];
      return toSortedUnique(locales);
    }
    const locales = playStoreDetail?.listings?.map((entry) => entry.locale) ?? [];
    return toSortedUnique(locales);
  }, [appStoreDetail?.localizations, playStoreDetail?.listings, selectedStore]);
  const selectedLocale = selectedLocaleByStore[selectedStore];
  const effectiveLocale = localeOptions.includes(selectedLocale) ? selectedLocale : localeOptions[0] || "";

  const selectedAppStoreLocalization =
    appStoreDetail?.localizations?.find((entry) => entry.locale === effectiveLocale) ??
    appStoreDetail?.localizations?.[0];
  const selectedPlayListing =
    playStoreDetail?.listings?.find((entry) => entry.locale === effectiveLocale) ??
    playStoreDetail?.listings?.[0];

  useEffect(() => {
    setSelectedProductByStore((prev) => {
      const next = { ...prev };
      let changed = false;

      const syncStore = (store: StoreId, storeItems: StoreIapEntry[]) => {
        const current = next[store];
        const exists = current && storeItems.some((entry) => entry.productId === current);
        if (exists) return;
        const fallback = storeItems[0]?.productId ?? "";
        if (fallback !== current) {
          next[store] = fallback;
          changed = true;
        }
      };

      syncStore("app_store", appStoreIaps);
      syncStore("play_store", playStoreIaps);

      return changed ? next : prev;
    });
  }, [appStoreIaps, playStoreIaps]);

  useEffect(() => {
    if (!selectedItemProductId) return;
    setSelectedProductByStore((prev) => {
      if (prev[selectedStore] === selectedItemProductId) return prev;
      return { ...prev, [selectedStore]: selectedItemProductId };
    });
  }, [selectedItemProductId, selectedStore]);

  useEffect(() => {
    setSelectedLocaleByStore((prev) => {
      const current = prev[selectedStore];
      if (current && localeOptions.includes(current)) return prev;
      const fallback = localeOptions[0] ?? "";
      if (current === fallback) return prev;
      return { ...prev, [selectedStore]: fallback };
    });
  }, [localeOptions, selectedStore]);

  useEffect(() => {
    if (isOpen) return;
    setDraftValues({});
  }, [isOpen]);

  const readDraftValue = (
    field: string,
    baseValue: string | undefined,
    locale: string = "__global__"
  ): string => {
    if (!selectedItemProductId) return baseValue ?? "";
    const key = toDraftKey(selectedStore, selectedItemProductId, locale || "__global__", field);
    return hasOwn(draftValues, key) ? draftValues[key] : baseValue ?? "";
  };

  const writeDraftValue = (
    field: string,
    nextValue: string,
    locale: string = "__global__"
  ): void => {
    if (!selectedItemProductId) return;
    const key = toDraftKey(selectedStore, selectedItemProductId, locale || "__global__", field);
    setDraftValues((prev) => ({ ...prev, [key]: nextValue }));
  };

  const selectedStoreLabel = selectedStore === "app_store" ? "App Store" : "Play Store";

  return (
    <dialog ref={dialogRef} className="iap-dialog">
      <section className="card rules-modal iap-modal">
        <div className="generate-header">
          <h2>In-App Purchases</h2>
          <div className="modal-actions">
            <Button
              type="button"
              variant="primary"
              onClick={() => onGenerate(selectedStore)}
              disabled={isLoading || isGenerating || items.length === 0}
              title={`Source locale: ${sourceLocale || "n/a"}`}
            >
              {isGenerating ? "Generate..." : "Generate"}
            </Button>
            <Button type="button" variant="danger" onClick={onClose} disabled={isLoading}>
              Kapat
            </Button>
          </div>
        </div>

        <div className="generate-store-toggle">
          <Button
            type="button"
            variant={selectedStore === "app_store" ? "primary" : "ghost"}
            onClick={() => onSelectStore("app_store")}
            disabled={!canShowIos}
          >
            App Store ({appStoreIaps.length})
          </Button>
          <Button
            type="button"
            variant={selectedStore === "play_store" ? "primary" : "ghost"}
            onClick={() => onSelectStore("play_store")}
            disabled={!canShowPlay}
          >
            Play Store ({playStoreIaps.length})
          </Button>
        </div>

        <div className="iap-workspace">
          <aside className="iap-products-panel">
            <div className="iap-products-head">
              <strong>{selectedStoreLabel} IAP</strong>
              <span>{items.length}</span>
            </div>

            {isLoading ? <p>IAP listesi yukleniyor...</p> : null}
            {!isLoading && items.length === 0 ? (
              <p>Bu store icin sync edilmis IAP bulunamadi.</p>
            ) : null}

            {!isLoading && items.length > 0 ? (
              <ul className="iap-products-list">
                {items.map((item) => {
                  const appStoreItem = selectedStore === "app_store" ? asAppStoreIapDetail(item.detail) : null;
                  const playStoreItem = selectedStore === "play_store" ? asPlayStoreIapDetail(item.detail) : null;
                  const isActive = selectedItemProductId === item.productId;

                  return (
                    <li key={`${item.store}-${item.productId}`}>
                      <button
                        type="button"
                        className={`iap-product-btn ${isActive ? "active" : ""}`}
                        onClick={() =>
                          setSelectedProductByStore((prev) => ({
                            ...prev,
                            [selectedStore]: item.productId,
                          }))
                        }
                      >
                        <div className="iap-product-id">{item.productId}</div>
                        <div className="iap-product-sub">
                          {selectedStore === "app_store"
                            ? appStoreItem?.referenceName || appStoreItem?.inAppPurchaseType || "metadata yok"
                            : playStoreItem?.purchaseType || playStoreItem?.status || "metadata yok"}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </aside>

          <section className="iap-editor-panel">
            {!isLoading && !selectedItem ? <p>Duzenlemek icin bir IAP sec.</p> : null}

            {selectedItem ? (
              <>
                <div className="iap-editor-top">
                  <label className="iap-select-field">
                    Urun
                    <select
                      value={selectedItemProductId}
                      onChange={(event) =>
                        setSelectedProductByStore((prev) => ({
                          ...prev,
                          [selectedStore]: event.target.value,
                        }))
                      }
                    >
                      {items.map((item) => (
                        <option key={`${item.store}-${item.productId}`} value={item.productId}>
                          {item.productId}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="iap-select-field">
                    Locale
                    <SourceLocaleSelect
                      name={`iap-locale-${selectedStore}`}
                      value={effectiveLocale}
                      options={localeOptions}
                      disabled={localeOptions.length === 0}
                      required={false}
                      placeholder={localeOptions.length > 0 ? undefined : "Locale yok"}
                      onChange={(locale) =>
                        setSelectedLocaleByStore((prev) => ({
                          ...prev,
                          [selectedStore]: locale,
                        }))
                      }
                    />
                  </label>
                </div>

                {selectedStore === "app_store" ? (
                  <div className="iap-form-grid">
                    <label>
                      Product ID
                      <input type="text" value={selectedItem.productId} readOnly className="iap-readonly" />
                    </label>
                    <label>
                      Reference Name
                      <input
                        type="text"
                        value={readDraftValue("referenceName", appStoreDetail?.referenceName)}
                        onChange={(event) =>
                          writeDraftValue("referenceName", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Type
                      <input
                        type="text"
                        value={appStoreDetail?.inAppPurchaseType || ""}
                        readOnly
                        className="iap-readonly"
                      />
                    </label>
                    <label>
                      State
                      <input
                        type="text"
                        value={appStoreDetail?.state || ""}
                        readOnly
                        className="iap-readonly"
                      />
                    </label>
                    <label>
                      Family Sharable
                      <input
                        type="text"
                        value={
                          typeof appStoreDetail?.familySharable === "boolean"
                            ? appStoreDetail.familySharable
                              ? "true"
                              : "false"
                            : ""
                        }
                        readOnly
                        className="iap-readonly"
                      />
                    </label>
                    <label className="iap-full-row">
                      Name
                      <input
                        type="text"
                        value={readDraftValue(
                          "name",
                          selectedAppStoreLocalization?.name,
                          effectiveLocale
                        )}
                        onChange={(event) =>
                          writeDraftValue("name", event.target.value, effectiveLocale)
                        }
                      />
                    </label>
                    <label className="iap-full-row">
                      Description
                      <textarea
                        value={readDraftValue(
                          "description",
                          selectedAppStoreLocalization?.description,
                          effectiveLocale
                        )}
                        onChange={(event) =>
                          writeDraftValue("description", event.target.value, effectiveLocale)
                        }
                      />
                    </label>
                  </div>
                ) : (
                  <div className="iap-form-grid">
                    <label>
                      Product ID
                      <input type="text" value={selectedItem.productId} readOnly className="iap-readonly" />
                    </label>
                    <label>
                      Purchase Type
                      <input
                        type="text"
                        value={playStoreDetail?.purchaseType || ""}
                        readOnly
                        className="iap-readonly"
                      />
                    </label>
                    <label>
                      Status
                      <input
                        type="text"
                        value={playStoreDetail?.status || ""}
                        readOnly
                        className="iap-readonly"
                      />
                    </label>
                    <label>
                      Default Language
                      <input
                        type="text"
                        value={playStoreDetail?.defaultLanguage || ""}
                        readOnly
                        className="iap-readonly"
                      />
                    </label>
                    <label className="iap-full-row">
                      Title
                      <input
                        type="text"
                        value={readDraftValue("title", selectedPlayListing?.title, effectiveLocale)}
                        onChange={(event) =>
                          writeDraftValue("title", event.target.value, effectiveLocale)
                        }
                      />
                    </label>
                    <label className="iap-full-row">
                      Description
                      <textarea
                        value={readDraftValue(
                          "description",
                          selectedPlayListing?.description,
                          effectiveLocale
                        )}
                        onChange={(event) =>
                          writeDraftValue("description", event.target.value, effectiveLocale)
                        }
                      />
                    </label>
                    <label className="iap-full-row">
                      Benefits (satir bazli)
                      <textarea
                        value={readDraftValue(
                          "benefits",
                          (selectedPlayListing?.benefits ?? []).join("\n"),
                          effectiveLocale
                        )}
                        onChange={(event) =>
                          writeDraftValue("benefits", event.target.value, effectiveLocale)
                        }
                      />
                    </label>
                  </div>
                )}
              </>
            ) : null}
          </section>
        </div>
      </section>
    </dialog>
  );
}
