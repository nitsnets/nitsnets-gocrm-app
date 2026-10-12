<?php

namespace Database\Seeders;

use App\Models\Record;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new \RuntimeException('Demo seeding is restricted to local/testing environments.');
        }
        $w = Record::table('workspaces')->firstOrCreate(['name' => 'NitsNets'], []);
        $w2 = Record::table('workspaces')->firstOrCreate(['name' => 'Estudio Norte'], []);
        $users = [];
        foreach (['eladio' => 'Eladio Rodríguez', 'jose' => 'José Antonio', 'alberto' => 'Alberto Martínez'] as $key => $name) {
            $users[$key] = User::firstOrCreate(['email' => $key.'@nitsnets.demo'], ['name' => $name, 'password' => Hash::make('DemoCRM!2026'), 'email_verified_at' => now()]);
            Record::table('memberships')->firstOrCreate(['workspace_id' => $w->id, 'user_id' => $users[$key]->id], ['role' => $key === 'eladio' ? 'admin' : 'member']);
        }
        Record::table('memberships')->firstOrCreate(['workspace_id' => $w2->id, 'user_id' => $users['eladio']->id], ['role' => 'admin']);
        if (Record::table('contacts')->where('workspace_id', $w->id)->exists()) {
            return;
        }
        $company = Record::table('companies')->create(['workspace_id' => $w->id, 'name' => 'Atlas Digital', 'domain' => 'atlas.example', 'industry' => 'Tecnología', 'status' => 'active', 'website' => 'https://atlas.example', 'notes' => 'Datos de demostración.']);
        $old = Record::table('companies')->create(['workspace_id' => $w->id, 'name' => 'Orbita Studio', 'industry' => 'Diseño', 'status' => 'prospect']);
        $contact = Record::table('contacts')->create(['workspace_id' => $w->id, 'first_name' => 'Bernardo', 'last_name' => 'García', 'email' => 'bernardo@atlas.example', 'job_title' => 'Director de producto', 'phone' => '+34 600 111 222', 'notes' => 'Nos conocimos en el encuentro de Valencia. Datos de demostración.']);
        Record::table('affiliations')->create(['workspace_id' => $w->id, 'contact_id' => $contact->id, 'company_id' => $company->id, 'role' => 'Director de producto', 'started_on' => '2025-02-01']);
        Record::table('affiliations')->create(['workspace_id' => $w->id, 'contact_id' => $contact->id, 'company_id' => $old->id, 'role' => 'Responsable de diseño', 'started_on' => '2022-01-01', 'ended_on' => '2025-01-31']);
        $ana = Record::table('contacts')->create(['workspace_id' => $w->id, 'first_name' => 'Ana', 'last_name' => 'Soler', 'email' => 'ana@orbita.example', 'job_title' => 'Fundadora']);
        Record::table('affiliations')->create(['workspace_id' => $w->id, 'contact_id' => $ana->id, 'company_id' => $old->id, 'role' => 'Fundadora', 'started_on' => '2021-03-01']);
        $opp = Record::table('opportunities')->create(['workspace_id' => $w->id, 'title' => 'Evolución de la plataforma Atlas', 'company_id' => $company->id, 'contact_id' => $contact->id, 'stage' => 'proposal', 'value_minor' => 1850000, 'currency' => 'EUR', 'expected_close_on' => now()->addDays(20)->toDateString()]);
        Record::table('opportunities')->create(['workspace_id' => $w->id, 'title' => 'Portal de clientes Orbita', 'company_id' => $old->id, 'contact_id' => $ana->id, 'stage' => 'qualified', 'value_minor' => 820000, 'currency' => 'EUR']);
        foreach ([['Preparar propuesta para Bernardo', $contact->id, -1], ['Enviar referencias a Ana', $ana->id, 2]] as [$title,$cid,$days]) {
            Record::table('tasks')->create(['workspace_id' => $w->id, 'title' => $title, 'contact_id' => $cid, 'author_id' => $users['eladio']->id, 'due_at' => now()->addDays($days), 'status' => 'pending']);
        }
        Record::table('notes')->create(['workspace_id' => $w->id, 'body' => 'Bernardo quiere revisar el alcance antes del viernes. Nota privada de demostración.', 'contact_id' => $contact->id, 'author_id' => $users['eladio']->id, 'visibility' => 'private']);
        Record::table('notes')->create(['workspace_id' => $w->id, 'body' => 'Atlas busca mejorar la experiencia de sus clientes.', 'contact_id' => $contact->id, 'company_id' => $company->id, 'author_id' => $users['jose']->id, 'visibility' => 'workspace']);
        foreach ([['Consulta privada sobre el proyecto', ['eladio']], ['Revisión conjunta de la propuesta', ['eladio', 'jose']], ['Encuentro del equipo Atlas', ['eladio', 'jose', 'alberto']]] as [$subject,$keys]) {
            $message = Record::table('messages')->create(['workspace_id' => $w->id, 'subject' => $subject, 'from_email' => 'bernardo@atlas.example', 'from_name' => 'Bernardo García', 'to' => array_map(fn ($key) => $users[$key]->email, $keys), 'cc' => [], 'received_at' => now()->subHours(count($keys)), 'body_text' => 'Hola, me gustaría que revisáramos el proyecto de Atlas. ¿Podemos preparar una propuesta esta semana? Un saludo, Bernardo. [Correo de demostración]', 'contact_id' => $contact->id, 'company_id' => $company->id]);
            foreach ($keys as $key) {
                Record::table('message_participants')->create(['message_id' => $message->id, 'user_id' => $users[$key]->id]);
            }
        }
        Record::table('events')->create(['workspace_id' => $w->id, 'name' => 'Encuentro de producto · Valencia', 'location' => 'Valencia', 'starts_at' => now()->addDays(5)->setTime(18, 0), 'notes' => 'Preparar las fichas de los contactos antes de asistir.', 'contact_ids' => [$contact->id, $ana->id]]);
        $quote = Record::table('quotes')->create(['workspace_id' => $w->id, 'title' => 'Propuesta Atlas · Descubrimiento y diseño', 'company_id' => $company->id, 'opportunity_id' => $opp->id, 'status' => 'draft', 'currency' => 'EUR', 'items' => [['description' => 'Descubrimiento y definición', 'quantity' => 1, 'unit_price_minor' => 250000, 'line_total_minor' => 250000], ['description' => 'Diseño de experiencia', 'quantity' => 40, 'unit_price_minor' => 8500, 'line_total_minor' => 340000]], 'total_minor' => 590000, 'version' => 1, 'notes' => 'Importes sin impuestos. Presupuesto de demostración.']);
        Record::table('quote_versions')->create(['workspace_id' => $w->id, 'quote_id' => $quote->id, 'version' => 1, 'snapshot' => $quote->toArray()]);
        Record::table('companies')->create(['workspace_id' => $w2->id, 'name' => 'Cliente exclusivo del Estudio Norte', 'status' => 'active']);
        Record::table('contacts')->create(['workspace_id' => $w2->id, 'first_name' => 'Lucía', 'last_name' => 'Norte', 'email' => 'lucia@norte.example']);
    }
}
