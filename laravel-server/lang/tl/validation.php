<?php

/*
 * Tagalog validation messages for the rules this app uses. Anything not
 * listed here falls back to the English framework message.
 */
return [
    'array' => 'Dapat listahan ang :attribute.',
    'between' => [
        'numeric' => 'Dapat nasa pagitan ng :min at :max ang :attribute.',
        'string' => 'Dapat nasa pagitan ng :min at :max na character ang :attribute.',
        'array' => 'Dapat may :min hanggang :max na item ang :attribute.',
    ],
    'boolean' => 'Dapat oo o hindi ang :attribute.',
    'confirmed' => 'Hindi tugma ang kumpirmasyon ng :attribute.',
    'date' => 'Hindi wastong petsa ang :attribute.',
    'email' => 'Dapat wastong email address ang :attribute.',
    'gt' => [
        'numeric' => 'Dapat higit sa :value ang :attribute.',
        'string' => 'Dapat higit sa :value na character ang :attribute.',
    ],
    'image' => 'Dapat larawan ang :attribute.',
    'in' => 'Hindi wasto ang napiling :attribute.',
    'max' => [
        'numeric' => 'Hindi dapat higit sa :max ang :attribute.',
        'file' => 'Hindi dapat higit sa :max kilobytes ang :attribute.',
        'string' => 'Hindi dapat higit sa :max na character ang :attribute.',
        'array' => 'Hindi dapat higit sa :max na item ang :attribute.',
    ],
    'mimes' => 'Dapat file na may uri ang :attribute: :values.',
    'min' => [
        'numeric' => 'Dapat hindi bababa sa :min ang :attribute.',
        'file' => 'Dapat hindi bababa sa :min kilobytes ang :attribute.',
        'string' => 'Dapat hindi bababa sa :min na character ang :attribute.',
        'array' => 'Dapat may hindi bababa sa :min na item ang :attribute.',
    ],
    'numeric' => 'Dapat numero ang :attribute.',
    'regex' => 'Hindi wasto ang format ng :attribute.',
    'required' => 'Kailangan ang :attribute.',
    'required_with' => 'Kailangan ang :attribute kapag may :values.',
    'string' => 'Dapat teksto ang :attribute.',
    'unique' => 'Nagamit na ang :attribute.',
    'attributes' => [],
];
