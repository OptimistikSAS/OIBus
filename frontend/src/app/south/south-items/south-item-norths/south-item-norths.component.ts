import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, model, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { NorthConnectorDTO } from '@oibus/shared/api/north-connector.model';
import {
  SouthConnectorCommandDTO,
  SouthConnectorItemCommandDTO,
  SouthConnectorItemDTO,
  SouthItemNorthTransformerCommandDTO,
  SouthItemTransformerScope
} from '@oibus/shared/api/south-connector.model';
import { TransformerDTO } from '@oibus/shared/api/transformer.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';

import { transformerName, transformerOptionsSummary } from '../../../north/north-summary';
import {
  findDefaultTransformer,
  ItemRouting,
  resolveItemRouting,
  RoutingLevel
} from '../../../north/north-transformers/transformer-routing';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { TransformerService } from '../../../services/transformer.service';
import { addAttributeToForm, addEnablingConditions } from '../../../shared/form/dynamic-form.builder';
import { OIBUS_FORM_MODE } from '../../../shared/form/oibus-form-mode.token';
import { OIBusObjectFormControlComponent } from '../../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { OIBusNorthTypeEnumPipe } from '../../../shared/oibus-north-type-enum.pipe';
import { getAssociatedInputType, isTransformerApplicable } from '../../../shared/utils/utils';
import SouthItemTestComponent, { ItemTestTransformer } from '../south-item-test/south-item-test.component';

/** What tells where the data of an item goes: its id (none before it is saved), its group, and what it is tested with */
export type RoutedSouthItem = Pick<SouthConnectorItemCommandDTO, 'id' | 'name' | 'settings' | 'groupId' | 'groupName'>;

/** The scopes a transformer is attached at along with an item, the narrowest first: a narrower one takes over a wider one */
const SCOPES: Array<SouthItemTransformerScope> = ['item', 'group', 'south'];
const SCOPE_RANKS: Record<RoutingLevel, number> = { south: 0, group: 1, item: 2 };

/** Where the data of the item goes for one North */
export interface NorthRoute {
  north: NorthConnectorDTO;
  /** The data types the North accepts */
  acceptedTypes: Array<string>;
  /** The transformer of the North the item is routed to, `null` when its data is dropped */
  routing: ItemRouting | null;
  /** The transformer attached along with the item, saved with it */
  attachment: SouthItemNorthTransformerCommandDTO | null;
  /** The scopes a transformer can be attached at, to take over the routing: narrower than its own */
  scopes: Array<SouthItemTransformerScope>;
  /** The transformers that can be attached: they take the data of the item and give a type the North accepts */
  transformers: Array<TransformerDTO>;
}

type AttachmentForm = FormGroup<{
  scope: FormControl<SouthItemTransformerScope>;
  transformer: FormControl<TransformerDTO | null>;
  options: FormGroup;
}>;

const groupOf = (item: SouthConnectorItemDTO | SouthConnectorItemCommandDTO): { id: string | null; name: string | null } =>
  'group' in item
    ? { id: item.group?.id ?? null, name: item.group?.standardSettings.name ?? null }
    : { id: item.groupId, name: item.groupName };

/**
 * The Norths the data of a south item is sent to, and through which transformer: one attached to the item, to its group, or
 * to all the items of its south. The item can be tested through each of them, and new transformers can be attached to
 * send its data to more Norths, or through another transformer: they are saved with the item (see `attachments`).
 */
@Component({
  selector: 'oib-south-item-norths',
  templateUrl: './south-item-norths.component.html',
  styleUrls: [
    './south-item-norths.component.scss',
    '../../../north/north-transformers/routing-rows.scss',
    // the transformer cards
    '../../../north/north-transformers/edit-north-transformer-modal/edit-north-transformer-modal.component.scss'
  ],
  imports: [
    ReactiveFormsModule,
    TranslateDirective,
    TranslatePipe,
    OIBusObjectFormControlComponent,
    OIBusNorthTypeEnumPipe,
    SouthItemTestComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // the options of a transformer being attached are new ones, whether the item is new or edited
  viewProviders: [{ provide: OIBUS_FORM_MODE, useValue: () => 'create' }]
})
export class SouthItemNorthsComponent {
  private readonly northConnectorService = inject(NorthConnectorService);
  private readonly transformerService = inject(TransformerService);
  private readonly translateService = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  /** The south of the item ('create' while it is created) */
  readonly southId = input.required<string>();
  readonly item = input.required<RoutedSouthItem>();
  /** The connector of the item, to test it */
  readonly connectorCommand = input.required<Pick<SouthConnectorCommandDTO, 'type' | 'settings'>>();
  readonly manifest = input.required<SouthConnectorManifest>();
  /** The items of the south, to tell how many others a transformer of the group or of the south would send */
  readonly items = input<Array<SouthConnectorItemDTO | SouthConnectorItemCommandDTO>>([]);
  /** False to only show where the data goes, without attaching transformers */
  readonly editable = input(true);
  /** The transformers to attach along with the item when it is saved, one per North at most */
  readonly attachments = model<Array<SouthItemNorthTransformerCommandDTO>>([]);

  /** The Norths with their transformers, and the data types they accept */
  private readonly northsResource = rxResource({
    stream: () =>
      this.northConnectorService.list().pipe(
        switchMap(norths => (norths.length ? forkJoin(norths.map(north => this.northConnectorService.findById(north.id))) : of([]))),
        switchMap(norths => {
          const types = [...new Set(norths.map(north => north.type))];
          if (types.length === 0) return of([]);
          return forkJoin(types.map(type => this.northConnectorService.getNorthManifest(type))).pipe(
            map(manifests => norths.map(north => ({ north, acceptedTypes: manifests[types.indexOf(north.type)].types })))
          );
        }),
        catchError(() => of([]))
      )
  });
  private readonly transformersResource = rxResource({
    stream: () => this.transformerService.list().pipe(catchError(() => of([])))
  });
  readonly loading = computed(() => this.northsResource.isLoading());

  readonly routes = computed<Array<NorthRoute>>(() => {
    const item = this.item();
    const dataType = getAssociatedInputType(this.manifest().id);
    const transformers = this.transformersResource.hasValue() ? this.transformersResource.value() : [];
    const hasGroup = !!(item.groupId || item.groupName);
    const norths = this.northsResource.hasValue() ? this.northsResource.value() : [];
    return norths.map(({ north, acceptedTypes }) => {
      const routing = resolveItemRouting(north.transformers, this.southId(), { id: item.id ?? '', groupId: item.groupId });
      return {
        north,
        acceptedTypes,
        routing,
        attachment: this.attachments().find(attachment => attachment.northId === north.id) ?? null,
        scopes: SCOPES.filter(scope => (!routing || SCOPE_RANKS[scope] > SCOPE_RANKS[routing.level]) && (scope !== 'group' || hasGroup)),
        transformers: transformers.filter(transformer => isTransformerApplicable(transformer, dataType, acceptedTypes))
      };
    });
  });

  /** The transformers to attach, as summed up in the Review step of the item modal */
  readonly attachmentSummaries = computed(() =>
    this.routes()
      .filter(route => route.attachment)
      .map(route => {
        const transformer = this.findTransformer(route.attachment!.transformerId);
        return {
          northId: route.north.id,
          northName: route.north.name,
          transformerName: transformer ? this.transformerName(transformer) : route.attachment!.transformerId,
          scope: this.scopeLabel(route.attachment!.scope)
        };
      })
  );

  /** The North shown beside the list: the first one, until another is selected */
  readonly selectedNorthId = linkedSignal<Array<NorthRoute>, string | null>({
    source: this.routes,
    computation: (routes, previous) =>
      previous && routes.some(route => route.north.id === previous.value) ? previous.value : (routes[0]?.north.id ?? null)
  });
  readonly selectedRoute = computed(() => this.routes().find(route => route.north.id === this.selectedNorthId()) ?? null);

  /** The North a transformer is being attached to, until it is added or the attachment cancelled */
  readonly draftNorthId = signal<string | null>(null);
  readonly draftForm: AttachmentForm = this.fb.group({
    scope: this.fb.control<SouthItemTransformerScope>('item'),
    transformer: this.fb.control<TransformerDTO | null>(null, Validators.required),
    options: this.fb.group({})
  });
  private readonly draftEvents = toSignal(this.draftForm.events);
  readonly draftScope = computed(() => {
    this.draftEvents();
    return this.draftForm.controls.scope.value;
  });
  readonly draftTransformer = computed(() => {
    this.draftEvents();
    return this.draftForm.controls.transformer.value;
  });

  /**
   * How many other items of the south the transformer being attached to their group, or to the whole south, would also
   * send to the North: the ones it does not get yet. `null` for a transformer of the item alone.
   */
  readonly draftImpact = computed(() => {
    const route = this.selectedRoute();
    const scope = this.draftScope();
    if (!route || scope === 'item') return null;
    const item = this.item();
    return this.items().filter(other => {
      if (item.id ? other.id === item.id : other.name === item.name) return false;
      const group = groupOf(other);
      if (scope === 'group' && !(item.groupId ? group.id === item.groupId : group.name === item.groupName)) return false;
      return !resolveItemRouting(route.north.transformers, this.southId(), { id: other.id ?? '', groupId: group.id });
    }).length;
  });

  /** What the item is tested with for the selected North: the transformer being attached, attached, or routed to */
  readonly testTransformer = computed<ItemTestTransformer | null>(() => {
    const route = this.selectedRoute();
    if (!route) return null;
    if (this.draftNorthId() === route.north.id) {
      this.draftEvents();
      const transformer = this.draftForm.controls.transformer.value;
      return transformer ? { transformer, options: this.draftForm.controls.options.getRawValue() } : null;
    }
    if (route.attachment) {
      const transformer = this.findTransformer(route.attachment.transformerId);
      return transformer ? { transformer, options: route.attachment.options } : null;
    }
    return route.routing ? { transformer: route.routing.transformer.transformer, options: route.routing.transformer.options } : null;
  });

  selectNorth(northId: string) {
    if (northId === this.selectedNorthId()) return;
    this.selectedNorthId.set(northId);
    this.draftNorthId.set(null);
  }

  /** Opens the form to attach a transformer to the North, or to change the one attached */
  startAttachment(route: NorthRoute) {
    const attachment = route.attachment;
    const transformer = attachment
      ? this.findTransformer(attachment.transformerId)
      : findDefaultTransformer(route.transformers, getAssociatedInputType(this.manifest().id), route.acceptedTypes);
    this.draftForm.reset({ scope: attachment?.scope ?? route.scopes[0], transformer: null });
    this.selectTransformer(transformer);
    if (attachment) {
      this.draftForm.controls.options.patchValue(attachment.options);
    }
    this.draftNorthId.set(route.north.id);
  }

  selectTransformer(transformer: TransformerDTO | null) {
    if (transformer && transformer.id === this.draftForm.controls.transformer.value?.id) return;
    const options = this.fb.group({});
    for (const attribute of transformer?.manifest.attributes ?? []) {
      addAttributeToForm(this.fb, options, attribute);
    }
    if (transformer) {
      addEnablingConditions(options, transformer.manifest.enablingConditions);
    }
    this.draftForm.setControl('options', options);
    this.draftForm.controls.transformer.setValue(transformer);
  }

  /** Adds the transformer being attached, replacing the one attached to the same North */
  addAttachment() {
    const northId = this.draftNorthId();
    const transformer = this.draftForm.controls.transformer.value;
    if (!northId || !transformer || this.draftForm.invalid) {
      this.draftForm.markAllAsTouched();
      return;
    }
    const attachment: SouthItemNorthTransformerCommandDTO = {
      northId,
      scope: this.draftForm.controls.scope.value,
      transformerId: transformer.id,
      options: this.draftForm.controls.options.getRawValue()
    };
    this.attachments.update(attachments => [...attachments.filter(element => element.northId !== northId), attachment]);
    this.draftNorthId.set(null);
  }

  cancelAttachment() {
    this.draftNorthId.set(null);
  }

  removeAttachment(route: NorthRoute) {
    this.attachments.update(attachments => attachments.filter(attachment => attachment.northId !== route.north.id));
  }

  findTransformer(transformerId: string): TransformerDTO | null {
    return (
      (this.transformersResource.hasValue() ? this.transformersResource.value() : []).find(
        transformer => transformer.id === transformerId
      ) ?? null
    );
  }

  transformerName(transformer: TransformerDTO): string {
    return transformerName(transformer, this.translateService);
  }

  optionsSummary(transformer: ItemTestTransformer): string {
    return transformerOptionsSummary(transformer, this.translateService);
  }

  /** What a scope applies to, e.g. "its group (Line A)" */
  scopeLabel(scope: SouthItemTransformerScope): string {
    return this.translateService.instant(`south.items.norths.scope.${scope}`, { group: this.item().groupName ?? '' });
  }
}
